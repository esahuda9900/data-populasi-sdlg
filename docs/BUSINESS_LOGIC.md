# SDLG Unit Lifecycle — Business Logic (Canonical)

Last updated: 2026-10-14 (Phase 6 — end-first pipeline)

---

## 1. Keys

- Primary: **VIN**
- Fallback: model + 6-digit serial

## 2. Date sources (OLDP)

| Field | Meaning |
|-------|--------|
| `bl_ship_out_date` | Bill of Lading / ship-out China |
| `arrival_date` | Arrival inspection |
| `pdi_date` | PDI |
| **`sales_date`** | **Closing SDLG ≈ commissioning complete di sistem OLDP** |
| `ms1/2/3_date` | Maintenance stock dates |

## 3. Two definitions of “complete”

| Level | Rule |
|-------|------|
| **Complete OLDP** | `sales_date` terisi di OLDP |
| **Complete cabang** | penjualan + PDI + (SJU → ada WO AX) + ideally sales_date OLDP |

## 4. Decision tree (end → start)

1. **Ada sales_date OLDP?** → `COMPLETE_OLDP` (prioritas rendah untuk ops harian)
2. **Tidak** → cek **penjualan** lokal:
   - Sold + belum PDI → wajib PDI
   - Sold + belum WO AX → input WO (semua WO dihitung, tidak filter tipe)
   - Sold + PDI + WO → dorong closing `sales_date` OLDP
3. **Ada SJU tanpa penjualan/OLDP sales?** → rekonsiliasi
4. **Stock** (tidak OLDP sales & tidak penjualan):
   - Umur stock = **hari sejak BL** (bukan arrival)
   - ≥90 hari → MS1; ≥120 → MS2; ≥150 → MS3; lanjut +30 hari sampai PDI+sold
   - BL ada, arrival kosong, BL >7 hari → isi arrival
5. Setelah PDI+sold, tahun BL = 2026 → CSA wajib

## 5. Server views

- `v_unit_pipeline` — per unit: flags, `pipeline_stage`, `next_action`, `stock_age_days_bl`
- `v_pipeline_summary` — agregat dashboard

WO AX: **`has_wo_ax` = ada minimal 1 work order** (tidak filter description).

## 6. Dashboard

Page **Pipeline Closing & Stock** memakai view di atas.

Lihat juga `docs/DATA_DICTIONARY.md`.
