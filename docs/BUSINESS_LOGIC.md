# SDLG Unit Lifecycle — Business Logic (Canonical)

Dokumen ini adalah **sumber kebenaran** alur proses unit SDLG di proyek ini.
Semua fitur tracking, compliance, dan gap analysis harus mengikuti logic di bawah.

Last updated: 2026-10-13

---

## 1. Identitas Unit (Lookup Key)

| Prioritas | Key | Contoh | Catatan |
|-----------|-----|--------|--------|
| **1 (utama)** | **VIN** / nomor mesin (整机号) | `VLGL956HLS0621660` | Unique, dipakai di semua sistem SDLG |
| **2 (fallback)** | **Model + 6 digit serial** | Model `L956H` + `621660` | Jika VIN kosong / tidak match |

**Rule lookup di semua tabel:**
1. Cari by `VIN` exact match.
2. Jika tidak ketemu → parse model + 6 angka terakhir dari serial/unit_number, match ke `units.model` + `units.serial_number` (atau unit_number).
3. Jangan buat unit baru dari child data tanpa konfirmasi — unit master harus dari OLDP/CRM/kumpulan dulu.

---

## 2. Sumber Data (Staging)

| Sumber (staging) | Rows ~ | Peran |
|------------------|--------|-------|
| **data tarikan oldp** | 3.677 | Master unit dari sistem SDLG China/factory. VIN baru masuk di sini saat impor. Kolom proses: 到货日期, MS1/2/3, PDI, 销售日期 |
| **data tarikan dari crm** | 3.642 | Master unit dari CRM SDLG. Approval, end customer, area, warranty dates, file status |
| **data kumpulan semua data itr by lookup** | 4.159 | Olahan gabungan semua VIN (master list lokal). Harusnya ≈ union(OLDP, CRM). Kalau beda → ada unit missing → perlu analisa |
| **data penjualan unit** | 1.195 | Bukti unit **terjual** (invoice, salesman, branch, customer, service intervals) |
| **data sju** | 1.288 | **Delivery ke customer** (pick-up, delivery point, tanggal berangkat/sampai, forwarder, cabang) |
| **data wo ax** | 572 | **Work Order / Commissioning** di site customer (case number, status, PIC, type MW = commissioning) |

**Relasi ke tabel normalized:**
- `units` ← OLDP + CRM + kumpulan (master populasi)
- `unit_process` ← dates/status dari OLDP + logika MS/PDI/Comm
- `unit_sales` ← data penjualan unit
- `unit_deliveries` ← data sju
- `work_orders` ← data wo ax
- `crm_records` ← data tarikan dari crm
- `unit_documents` ← checklist (CSA, BPKB, dll) per unit

---

## 3. Alur Proses Unit (End-to-End)

```
[1] IMPOR DARI CHINA
    └─ Bill of Lading (BL) / year_delivery / bill_of_lading
    └─ Unit masuk sistem SDLG → muncul di OLDP + CRM (VIN baru)

[2] ARRIVAL INSPECTION (wajib)
    └─ arrival_check = DONE
    └─ Sumber: 到货日期 (OLDP) / ARRIVAL DATE
    └─ Setelah ini → status STOCK

[3] MAINTENANCE STOCK (conditional, berulang)
    └─ Trigger: hari sejak arrival_date > 90 hari (≈ 3 bulan)
    └─ MS1 wajib jika stock ≥ 3 bulan dan belum terjual
    └─ MS2 jika masih stock bulan berikutnya (belum terjual)
    └─ MS3 dst. sampai unit terjual / keluar stock
    └─ Field: ms_check_1, ms_check_2, ms_check_3

[4] PENJUALAN
    └─ Ada di data penjualan unit → unit_sales
    └─ Tandai unit terjual (bukan pure stock lagi)

[5] CSA (Customer Service Agreement) — CONDITIONAL
    └─ WAJIB jika year_delivery / BL tahun = 2026
    └─ Document type CSA harus status uploaded (bukan missing)
    └─ Tahun selain 2026: tidak wajib (atau policy terpisah)

[6] PDI CHECK (Pre-Delivery Inspection) — wajib sebelum kirim customer
    └─ pdi_check = DONE
    └─ Sumber: 交机前点检日期(PDI) / PDI DATE

[7] DELIVERY KE CUSTOMER
    └─ Ada di data sju → unit_deliveries
    └─ berangkat_date, sampai_date, delivery_point, forwarder

[8] COMMISSIONING DI SITE CUSTOMER
    └─ Ada di data wo ax (biasanya Type MW / Description mengandung COMMISSIONING)
    └─ comm_check = DONE
    └─ work_orders.status biasanya Closed setelah selesai

[9] SERAH TERIMA KE CUSTOMER
    └─ Semua tahap [2]–[8] harus lengkap
    └─ Unit “aman” = tidak ada gate yang bolong
```

---

## 4. Gate Logic (Sequential — Tidak Boleh Skip)

Proses bersifat **berurutan**. Satu tahap bolong → tahap berikutnya tidak boleh dianggap selesai / tidak boleh diproses lanjut di operational sense.

| Gate | Syarat lolos | Blocker jika kosong |
|------|--------------|---------------------|
| G1 Arrival | `arrival_check = DONE` atau ada arrival_date | Tidak boleh MS / PDI formal |
| G2 MS (jika stock ≥ 3 bln & belum sold) | `ms_check_N = DONE` sesuai umur stock | Stock compliance merah |
| G3 Sold | Row di `unit_sales` | Belum boleh PDI final / delivery formal |
| G4 CSA (jika BL 2026) | Document CSA = uploaded | Block sebelum PDI/delivery 2026 |
| G5 PDI | `pdi_check = DONE` | Tidak boleh kirim ke customer |
| G6 Delivery | Row di `unit_deliveries` (sampai/berangkat) | Belum di customer |
| G7 Comm | `comm_check = DONE` atau WO commissioning Closed | Belum serah terima final |

**Rule compliance “unit sudah di customer”:**  
Jika unit punya delivery (SJU) **atau** commissioning (WO) **atau** sales + delivery, maka **semua gate sebelumnya wajib DONE**. Kalau ada yang bolong → **anomaly / gap** yang harus dianalisa (data missing di source, belum diinput, atau proses memang terlewat).

---

## 5. Maintenance Stock — Detail Waktu

```
arrival_date = T0

IF unit belum terjual:
  IF today >= T0 + 90 days  → MS1 wajib
  IF today >= T0 + ~120 days (bulan berikutnya setelah MS1 window) → MS2 wajib
  IF still stock → MS3 wajib
  ... dst sampai sold

IF unit sudah terjual (ada unit_sales):
  MS selanjutnya tidak wajib (stock sudah keluar)
```

Implementasi praktis di DB:
- `arrival_check` / tanggal arrival dari OLDP
- `ms_check_1/2/3` = DONE | KOSONG
- Dashboard flag: “MS overdue” = stock, belum sold, age ≥ 90d, ms_check_1 masih KOSONG

---

## 6. CSA Rule (2026)

```
IF year_delivery = 2026 OR bill_of_lading year = 2026:
  document_types.code = 'CSA' (atau nama setara) HARUS status = 'uploaded'
ELSE:
  CSA tidak memblokir gate (opsional)
```

---

## 7. Gap Analysis — “Kenapa kosong?”

Tujuan sistem: **tracking semua proses dari awal sampai akhir**, pastikan tidak ada data bolong.

### 7.1 VIN universe check
```
set_oldp  = DISTINCT VIN dari data tarikan oldp
set_crm   = DISTINCT VIN dari data tarikan dari crm
set_kump  = DISTINCT VIN dari data kumpulan...
set_units = DISTINCT VIN dari units

Expected: set_kump ≈ set_oldp ∪ set_crm ≈ set_units

Missing cases:
- Di kumpulan tapi tidak di OLDP/CRM → unit lokal / manual?
- Di OLDP/CRM tapi tidak di units → belum di-ETL ke master
- Di units tapi tidak di keduanya → perlu investigasi source
```

Observasi saat dokumen ini ditulis:
- OLDP VINs ≈ 3.677 | CRM ≈ 3.642 | units ≈ 4.158 | kumpulan ≈ 4.159
- Selisih units/kumpulan vs OLDP+CRM → ada unit ekstra di master lokal (perlu rekonsiliasi)

### 7.2 Process gap (per unit)
Untuk setiap unit, hitung status gate G1–G7.  
**Critical gap:** unit sudah “di customer” (punya delivery atau comm) tapi G1/G5/G7 (atau CSA 2026) masih KOSONG.

### 7.3 Sumber kebenaran per field
| Field | Source of truth |
|-------|-----------------|
| VIN, model, factory dates | OLDP / CRM |
| Arrival, MS, PDI dates | OLDP |
| Sales | data penjualan unit |
| Delivery | data sju |
| Commissioning | data wo ax |
| Customer end / approval | CRM |
| Aggregated view | data kumpulan (boleh lag; jangan jadi satu-satunya source) |

---

## 8. Status Operasional Unit (`units.status`)

| Status | Arti bisnis |
|--------|-------------|
| aktif | Beroperasi di customer |
| idle | Standby |
| maintenance | Sedang service/perbaikan |
| ready | Siap (setelah PDI, sebelum/sesudah stock) |
| sold | Terjual (bisa overlap dengan aktif setelah serah terima) |
| scrapped | Afkir |

Stock unit biasanya: belum ada `unit_sales`, `arrival_check=DONE`, status ready/idle.

---

## 9. Implikasi ke Produk (Fitur yang harus ada)

1. **Master units** sinkron dari OLDP + CRM + rekonsiliasi kumpulan  
2. **Process board** per gate (Arrival → MS → Sales → CSA → PDI → Delivery → Comm)  
3. **Gap / anomaly list**: unit di customer tapi gate bolong  
4. **MS overdue list**: stock ≥ 3 bulan, MS belum DONE  
5. **CSA 2026 checklist**: unit BL 2026 tanpa CSA uploaded  
6. **VIN lookup** universal di semua modul (AI update, import, detail drawer)  
7. **Audit**: setiap koreksi manual/AI tercatat (audit_log)

---

## 10. Anti-Pattern (Jangan Dilakukan)

- Jangan anggap `data kumpulan` sebagai source of truth tunggal (bisa outdated).
- Jangan skip gate: misal set `comm_check=DONE` padahal arrival masih KOSONG tanpa flag anomaly.
- Jangan match unit hanya by model tanpa 6-digit serial (banyak unit model sama).
- Jangan expose staging.* ke anon key (sudah di schema staging).

---

## 11. Ringkasan Satu Kalimat

> Setiap unit dilacak by **VIN** (fallback model+6 digit) dari impor China (BL) → arrival → stock/MS tiap 3 bulan → sold → CSA jika 2026 → PDI → kirim (SJU) → commissioning (WO) → serah terima; **satu gate bolong = proses belum aman**, terutama jika unit sudah di customer.

---

*File ini wajib dibaca sebelum mengubah logic process, compliance, atau ETL.*
