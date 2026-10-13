# Data Dictionary & Database SWOT

Last updated: 2026-10-14 (Phase 5b — full staging English snake_case)

---

## Architecture (3 layers)

```
staging.src_*   →  RAW imports (all columns snake_case English)
public.*        →  NORMALIZED operational tables
public.v_*      →  COMPLIANCE & reporting views
```

**App only uses `public`.** Staging is for ETL / analysis.

---

## Staging tables

| Table | Role | Key columns |
|-------|------|-------------|
| `src_oldp` | Factory / OLDP | `vin`, `bl_ship_out_date`, `arrival_date`, `ms1_date`, `pdi_date` |
| `src_crm` | CRM SDLG | `vin`, `dealer`, `end_customer_name`, `approval_status` |
| `src_sales` | Penjualan | `vin`, `invoice_sales`, `salesman`, `branch_sales` |
| `src_sju` | Delivery | `vin`, `pick_up_point`, `delivery_point`, `forwarder` |
| `src_work_orders` | WO AX | `chassis_number`, `case_number`, `wo_type`, `description` |
| `src_lookup_bundle` | Local snapshot | 91 cols — **not** single source of truth |

Views: `staging.v_oldp`, `v_crm`, `v_sales`, `v_sju`, `v_work_orders`, `v_lookup_bundle`  
Catalog: `SELECT * FROM public.v_data_sources;`

### OLDP date meaning

| Column | Meaning |
|--------|--------|
| `bl_ship_out_date` | BL / ship-out China (ex 出港日期) |
| `arrival_date` | Arrival inspection (ex 到货日期) |

### Query examples

```sql
SELECT vin, bl_ship_out_date, arrival_date FROM staging.src_oldp LIMIT 10;
SELECT vin, invoice_sales, salesman FROM staging.src_sales LIMIT 10;
SELECT vin, dealer, end_customer_name FROM staging.src_crm LIMIT 10;
SELECT chassis_number, case_number, description FROM staging.src_work_orders LIMIT 10;
```

---

## Public core

`units` (incl. `bl_date`), `unit_process`, `unit_documents`, `document_types`,  
`unit_sales`, `unit_deliveries`, `work_orders`, `crm_records`, `unit_warranty`,  
`audit_log`, `import_logs`

### Compliance views

`v_unit_compliance`, `v_compliance_summary`, `v_critical_gaps`, `v_ms_overdue`,  
`v_vin_reconciliation`, `v_data_sources`

---

## SWOT (short)

**S:** Clean English staging + normalized public + SQL gate engine.  
**W:** `src_lookup_bundle` still messy; staging dates often text/serial.  
**O:** Re-ETL scripts; archive lookup bundle; typed dates on re-import.  
**T:** Re-upload CSV with old headers without mapping; free-tier size.

See `docs/BUSINESS_LOGIC.md` for process gates.
