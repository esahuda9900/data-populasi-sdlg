# SDLG Unit Lifecycle — Business Logic v1 (Canonical)

**Last updated:** 2026-10-14  
**Status:** FINAL v1 — acuan proses operasional & engine web  
**Project:** data-populasi-sdlg · Supabase `xluokufxwxurjykfrjav`

Dokumen ini adalah **sumber kebenaran logic**. Jangan ubah rule di UI/SQL tanpa update file ini.

---

## 0. Prinsip desain

1. **End-first:** yang sudah `sales_date` di OLDP = complete sistem → tidak diganggu ops harian.
2. **Gap = flag + PIC**, bukan hard-block input data (data lapangan sering tidak linear).
3. **Tab terpisah** per masalah → operator jelas salah di mana, PIC siapa.
4. **Data terakhir menang** untuk cabang/customer: urutan prioritas di §8.

---

## 1. Kunci identitas unit

| Prioritas | Key |
|-----------|-----|
| 1 | **VIN** (trim, exact) |
| 2 | Fallback: **model + 6 digit** serial (contoh `600001`) |

Sumber master unit: gabungan OLDP, CRM, penjualan, SJU, WO, lookup bundle → tabel `public.units`.

---

## 2. Sumber data & arti field

| Sumber | Tabel staging / normalized | Arti operasional |
|--------|----------------------------|------------------|
| OLDP SDLG | `staging.src_oldp` → `unit_oldp_flags` | Sistem pabrik/SDLG |
| Penjualan | `unit_sales` | Unit terjual (lokal) |
| SJU | `unit_deliveries` | Keberangkatan / pengiriman |
| WO AX | `work_orders` | Aktivitas cabang; **commissioning** = §5 |
| Process lokal | `unit_process` | Flag arrival/MS/PDI/COMM manual |

### Field OLDP penting

| Field | Arti |
|-------|------|
| `bl_ship_out_date` | Bill of Lading / ship-out China (**acuan umur stock**) |
| `arrival_date` | Arrival inspection di Indonesia |
| `pdi_date` | PDI |
| **`sales_date`** | **Complete di OLDP** (export web SDLG; kadang field lain error — yang dipegang closing = sales_date) |
| `ms1/2/3_date` | Maintenance stock |

---

## 3. Definisi “complete”

| Level | Rule | Perilaku di web |
|-------|------|-----------------|
| **Complete OLDP** | `sales_date` terisi | Tab monitor saja; **bukan** antrian ops |
| **Belum complete** | Tidak ada `sales_date` | **Fokus utama** breakdown + PIC |

Catatan: unit complete OLDP boleh tanpa `pdi_date` di export (error historis OLDP). **Tidak** digebuk massal.

---

## 4. Hierarki proses ideal (setelah unit terjual)

Urutan **wajib jelas** (meski data aktual bisa loncat — tetap di-flag):

```
1. Unit TERJUAL (ada data penjualan)
2. Cek tahun BILL OF LADING
   └─ jika tahun BL = 2026 (atau ke atas sesuai policy 2026+)
      └─ WAJIB Customer Service Agreement (CSA)
3. PDI (wajib sebelum / saat siap kirim ke customer)
4. Keberangkatan SJU (pengiriman)
5. WO commissioning di cabang (lihat §5 deskripsi)
6. Isi / sync sales_date di OLDP  → COMPLETE
```

**CSA:** dicek **setelah terjual**.  
- BL tahun **2026** → CSA wajib  
- Bukan 2026 → CSA tidak wajib  
Lalu baru PDI → SJU → WO comm → sales_date OLDP.

**Stock (belum terjual):**

```
BL (China) → Arrival inspection
  → jika umur dari BL ≥ 3 bulan → MS1
  → setiap +1 bulan → MS2, MS3, … sampai unit terjual & PDI
```

Umur stock = **`CURRENT_DATE - bl_date`**, **bukan** dari arrival.

---

## 5. WO AX = commissioning? (deskripsi, bukan tipe)

Jenis/type WO **tidak** dipakai sebagai penentu.

**Commissioning = true** jika `description` (case-insensitive) match pola:

- `commissioning`, `commisioning`, `commision`, `comission`
- `commtest`
- kata `comm` sebagai token (hati-hati false positive — prioritaskan stem di atas)

Contoh nyata di data: `Commisioning Unit - SDLG WHEEL LOADER`, `COMMISSIONING UNIT …`, `PDI & Commisioning Unit …`.

| Flag di engine | Arti |
|----------------|------|
| `has_wo_ax` | Ada minimal 1 WO (info) |
| **`has_wo_comm`** | Ada WO yang deskripsinya commissioning (**ini yang dipakai PIC cabang**) |

---

## 6. Decision tree — unit BELUM sales_date OLDP

```
Ada penjualan?
├─ YA
│  ├─ Tahun BL = 2026 & belum CSA → gap CSA (PIC: dokumen)
│  ├─ Belum PDI → gap PDI (PIC: PDI team)
│  ├─ Belum SJU → gap keberangkatan (PIC: logistics)
│  ├─ Belum WO commissioning → gap cabang (PIC: cabang)
│  └─ Semua ada → PR upload/sync sales_date OLDP
│
├─ TIDAK ada penjualan, ADA SJU
│  └─ Cek tujuan SJU:
│     ├─ ke CUSTOMER (bukan stock/LDP cabang) → penjualan belum update (PIC: data jual)
│     └─ ke cabang/LDP → transfer internal; jangan anggap sold
│
├─ TIDAK penjualan, ADA WO commissioning saja
│  └─ Anomali: verifikasi VIN / apakah benar jual kita (tampil di web)
│
└─ TIDAK penjualan, TIDAK WO comm
   ├─ Ada PDI tanpa jual → anomali ringan (flag)
   └─ Stock path:
      ├─ Tidak ada BL → TAB TERPISAH “No BL” (cek manual) — §7
      ├─ Ada BL, belum arrival (>7 hari) → isi arrival
      └─ Umur BL ≥ 3 bln → MS1/2/3 due sampai PDI+sold
```

---

## 7. Tab “No BL” (cek manual)

Unit tanpa tanggal Bill of Lading **dipisah tab**.

Kolom wajib breakdown:

- VIN, unit, model  
- Ada penjualan? PDI? SJU? WO comm?  
- Cabang efektif (§8)  
- Customer  
- Sumber master (OLDP match / CRM only / dll.)  
- **Next action** + **PIC usulan**

Tujuan: operator tidak campur dengan antrian MS/sold.

---

## 8. Cabang / data “paling valid” = yang terakhir

Urutan prioritas field operasional (cabang, customer, lokasi):

1. **WO AX terbaru** (tanggal WO / updated_at)  
2. **SJU** terbaru  
3. **Penjualan** terbaru  
4. `units` / CRM / OLDP  

Logic: data **paling akhir di-update** menang.

---

## 9. PIC matrix (ringkas)

| Kondisi | PIC |
|---------|-----|
| Sold + SJU, belum WO commissioning | **Cabang** |
| Sold, belum SJU | **Keberangkatan / logistics** |
| Sold, BL 2026, belum CSA | **Dokumen / admin CSA** |
| Sold, belum PDI | **Tim PDI** |
| SJU ke customer, belum penjualan | **Data penjualan** (belum update) |
| WO comm tanpa penjualan | **Data quality** (cek VIN/jual) |
| Stock, MS due (umur BL) | **Workshop stock** |
| Stock, arrival missing | **Ops arrival** |
| No BL | **Ops + data** (tab manual) |
| Siap semua, belum sales_date OLDP | **Admin OLDP / PR upload** |

---

## 10. Perilaku gap di sistem

- **Flag saja** — tidak hard-block simpan data lain.  
- UI menampilkan: `pipeline_stage`, `next_action`, `pic`.  
- Export CSV per tab untuk cabang.

---

## 11. Refresh data OLDP flags (poin teknis #7)

Setelah upload CSV OLDP baru ke Supabase:

- Tabel `public.unit_oldp_flags` harus di-refresh dari `staging.src_oldp`.  
- Fungsi: `SELECT public.refresh_unit_oldp_flags();` (service role).  
- Tanpa refresh, web masih pakai snapshot flag lama.  

(Opsional ke depan: tombol admin “Refresh OLDP flags” atau trigger otomatis.)

---

## 12. Server objects

| Object | Peran |
|--------|--------|
| `unit_oldp_flags` | Snapshot OLDP aman untuk role authenticated |
| `v_unit_pipeline` | Per unit: flags, stage, next_action, stock_age_days_bl |
| `v_pipeline_summary` | KPI dashboard |
| `refresh_unit_oldp_flags()` | Refresh setelah CSV baru |

---

## 13. Tab Dashboard yang disarankan (v1 UI)

1. **Complete OLDP** — monitor  
2. **Sold — gap cabang (WO comm)**  
3. **Sold — gap keberangkatan (SJU)**  
4. **Sold — gap PDI / CSA 2026**  
5. **SJU tanpa penjualan** — rekonsiliasi  
6. **WO comm tanpa penjualan** — cek VIN  
7. **Stock — MS due** (umur dari BL)  
8. **Stock — arrival missing**  
9. **No BL** — cek manual  

---

## 14. Changelog logic

| Versi | Perubahan |
|-------|-----------|
| Phase 6 | End-first; stock age dari BL; semua WO dihitung |
| **v1 final** | WO commissioning by **description**; CSA setelah sold jika BL 2026; hierarki sold→CSA→PDI→SJU→WO→OLDP; tab No BL; PIC matrix; gap=flag; cabang dari data terbaru |
