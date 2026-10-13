# Data Dictionary & Database SWOT

Last updated: 2026-10-13 (Phase 5 — staging cleaned to English)

---

## Architecture (3 layers)

```
┌─────────────────────────────────────────────────────────┐
│  staging.src_*     RAW imports (CSV from SDLG / lokal)  │
│  English column names — not exposed to anon API daily   │
└──────────────────────────┬──────────────────────────────┘
                           │ ETL / backfill
┌──────────────────────────▼──────────────────────────────┐
│  public.*          NORMALIZED operational tables        │
│  units, unit_process, unit_sales, unit_deliveries, …    │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  public.v_*        COMPLIANCE & reporting views         │
│  v_unit_compliance, v_compliance_summary, …             │
└─────────────────────────────────────────────────────────┘
```

---

## Staging sources (English names)

| Table | Role | Rows ~ |
|-------|------|--------|
| `staging.src_oldp` | Factory/OLDP export | 3.677 |
| `staging.src_crm` | CRM SDLG | 3.642 |
| `staging.src_sales` | Penjualan / invoice | 1.195 |
| `staging.src_sju` | Delivery ke customer | 1.288 |
| `staging.src_work_orders` | WO AX / commissioning | 572 |
| `staging.src_lookup_bundle` | Gabungan lokal (bukan SoT) | 4.159 |

Aliases: `staging.v_oldp`, `v_crm`, `v_sales`, `v_sju`, `v_work_orders`, `v_lookup_bundle`.

### `src_oldp` columns (ex-Chinese)

| Column | Former Chinese | Meaning |
|--------|----------------|--------|
| `country_name` | 国家名称 | Country |
| `dealer_name` | 代理商名称 | Dealer |
| `model_code` | 型号编码 | Model code |
| `vin` | 整机号 | Machine VIN |
| **`bl_ship_out_date`** | **出港日期** | **BL / ship-out China** |
| **`arrival_date`** | **到货日期** | **Arrival inspection** |
| `ms1_date` | 第一次库存车保养日期 | MS1 |
| `ms2_date` | 第二次库存车保养日期 | MS2 |
| `ms3_date` | 第三次库存车保养日期 | MS3 |
| `pdi_date` | 交机前点检日期(PDI) | PDI |
| `sales_date` | 销售日期 | Sales date |

> Query example: `SELECT vin, bl_ship_out_date, arrival_date FROM staging.src_oldp LIMIT 10;`

---

## Public core tables

| Table | Purpose |
|-------|--------|
| `units` | Master populasi (+ `bl_date`, `year_delivery`, `bill_of_lading` ISO) |
| `unit_process` | Arrival / MS / PDI / Comm gates |
| `unit_documents` + `document_types` | Checklist docs (incl. CSA) |
| `unit_sales` | Sold |
| `unit_deliveries` | SJU |
| `work_orders` | Commissioning / WO |
| `crm_records` | CRM snapshot |
| `unit_warranty` | Warranty (masih tipis) |
| `audit_log` | Change history (siap) |
| `import_logs` | Import runs |

---

## Key views

| View | Use |
|------|-----|
| `v_unit_compliance` | Per-unit gates, blockers, MS overdue, CSA |
| `v_compliance_summary` | Dashboard aggregates |
| `v_critical_gaps` | At-customer + incomplete gates |
| `v_ms_overdue` | Stock MS due |
| `v_vin_reconciliation` | OLDP/CRM/units/kumpulan VIN sets |
| `v_data_sources` | Catalog staging sources + row counts |

---

## SWOT — Database (Expert)

### Strengths
- **Clear separation**: staging (raw) vs public (normalized) vs views (compliance).
- **Business keys**: VIN primary; BL + arrival dates from authoritative OLDP.
- **Gate engine in SQL** (`v_unit_compliance`) — single source of truth for Process UI.
- **RLS** on public tables; staging isolated from casual API use.
- **Free-tier friendly**: no extra services; Postgres views only.
- **English naming** on OLDP after Phase 5 — no daily Chinese column friction.

### Weaknesses
- Staging still has **messy English** from Excel (`Serial number‌` zero-width, spaces, `Column1`).
- `src_lookup_bundle` has **91 columns**, duplicated/outdated vs normalized tables.
- **CRM serial column** still awkward (`Serial number‌`) — hard to type in SQL.
- Dates in staging often **text / Excel serial**, not native `date` (parsed on ETL).
- **unit_warranty** empty; some child fields incomplete.
- High **critical_gap / MS overdue** counts = data quality debt, not schema debt.

### Opportunities
- Typed `date` columns on staging after re-import, or generated columns.
- Rename remaining CRM/SJU awkward columns in a Phase 5b.
- Materialized view for compliance summary if dashboard gets slow.
- One-shot script: re-ETL from `src_*` → public when CSV refreshed.
- Soft archive / drop `src_lookup_bundle` once recon proves units complete.

### Threats
- Re-uploading CSV **with Chinese headers** would create parallel tables if not mapped.
- Free-tier DB size if staging + public both grow without pruning.
- Logic drift if UI evaluates compliance differently from `v_unit_compliance`.
- Accidental exposure of staging if policies granted to `anon`.

---

## Rules of engagement

1. **App & reports** → only `public` tables/views.
2. **ETL / analysis of source files** → `staging.src_*` or `staging.v_*`.
3. **Never** treat `src_lookup_bundle` as sole source of truth.
4. **BL** = `src_oldp.bl_ship_out_date` → `units.bl_date`.
5. **Arrival** = `src_oldp.arrival_date` → `unit_process.arrival_date`.

See also: `docs/BUSINESS_LOGIC.md`.
