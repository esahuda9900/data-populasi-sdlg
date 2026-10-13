# SDLG Unit Lifecycle — Business Logic (Canonical)

Dokumen ini adalah **sumber kebenaran** alur proses unit SDLG di proyek ini.
Semua fitur tracking, compliance, dan gap analysis harus mengikuti logic di bawah.

Last updated: 2026-10-13 (Phase 4: BL + Arrival from OLDP)

---

## 1. Identitas Unit (Lookup Key)

| Prioritas | Key | Contoh | Catatan |
|-----------|-----|--------|--------|
| **1 (utama)** | **VIN** / nomor mesin (整机号) | `VLGL956HLS0621660` | Unique, dipakai di semua sistem SDLG |
| **2 (fallback)** | **Model + 6 digit serial** | Model `L956H` + `621660` | Jika VIN kosong / tidak match |

**Rule lookup di semua tabel:**
1. Cari by `VIN` exact match.
2. Jika tidak ketemu → parse model + 6 angka terakhir dari serial/unit_number.
3. Jangan buat unit baru dari child data tanpa konfirmasi.

---

## 2. Tanggal kritis dari OLDP (source of truth)

| Field OLDP | Arti | Mapping di DB |
|------------|------|---------------|
| **出港日期** | **Bill of Lading / ship-out** China → Indonesia | `units.bl_date` (date), `units.bill_of_lading` (YYYY-MM-DD), `units.year_delivery` = year(bl_date) |
| **到货日期** | **Arrival inspection** (unit tiba & dicek) | `unit_process.arrival_date`, `arrival_check = DONE` |

- Format sumber: text `M/D/YYYY` (contoh `12/31/2022`).
- Jangan pakai serial Excel mentah di UI; selalu konversi ke date/ISO.
- **CSA 2026** = tahun dari `bl_date` (atau `year_delivery`) = 2026.
- **MS overdue** dihitung dari `arrival_date` (bukan dari BL).

---

## 3. Sumber Data (Staging)

| Sumber (staging) | Rows ~ | Peran |
|------------------|--------|-------|
| **data tarikan oldp** | 3.677 | Master + 出港/到货 + MS/PDI dates |
| **data tarikan dari crm** | 3.642 | CRM / end customer / approval |
| **data kumpulan semua data itr by lookup** | 4.159 | Gabungan lokal (bukan SoT tunggal) |
| **data penjualan unit** | 1.195 | Sold |
| **data sju** | 1.288 | Delivery ke customer |
| **data wo ax** | 572 | Commissioning WO |

---

## 4. Alur Proses Unit (End-to-End)

```
[1] IMPOR — 出港日期 → bl_date / year_delivery (BL China)
[2] ARRIVAL — 到货日期 → arrival_date + arrival_check DONE → STOCK
[3] MS1/2/3 — jika belum sold & umur stock dari arrival_date ≥ 90/120/150 hari
[4] SOLD — unit_sales
[5] CSA — wajib jika year(bl_date)=2026
[6] PDI — sebelum kirim customer
[7] DELIVERY — unit_deliveries (SJU)
[8] COMMISSIONING — WO / comm_check
[9] SERAH TERIMA — semua gate lengkap
```

**Gate sequential:** satu bolong → proses belum aman.  
**Critical gap:** unit sudah di customer (delivery/comm) tapi gate awal bolong.

---

## 5. Views compliance (server)

- `v_unit_compliance` — per unit + `bl_date` + gates + blocker
- `v_compliance_summary` — agregat
- `v_critical_gaps` / `v_ms_overdue`
- `v_vin_reconciliation` (+ summary)

---

## 6. Ringkasan Satu Kalimat

> Setiap unit dilacak by **VIN**; **BL = 出港日期**, **Arrival = 到货日期**; lalu MS (dari arrival) → sold → CSA jika BL 2026 → PDI → SJU → commissioning; gate bolong = belum aman.

*File ini wajib dibaca sebelum mengubah logic process, compliance, atau ETL.*
