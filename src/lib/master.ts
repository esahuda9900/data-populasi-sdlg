import { supabase } from './supabase'

/** Row shape from public.v_unit_master */
export type UnitMaster = {
  unit_id: string
  vin: string | null
  unit_number: string | null
  serial_number: string | null
  sn6: string | null
  match_key: string | null
  model: string | null
  group_type: string | null
  variant: string | null
  year_delivery: number | null
  under_cabang: string | null
  customer: string | null
  customer_update: string | null
  location: string | null
  unit_status: string | null
  stock_status: string | null
  marketing_status: string | null
  device_number: string | null
  bill_of_lading: string | null
  bl_date: string | null
  oldp_bl_date: string | null
  oldp_arrival_date: string | null
  oldp_ms1_date: string | null
  oldp_ms2_date: string | null
  oldp_ms3_date: string | null
  oldp_pdi_date: string | null
  oldp_sales_date: string | null
  has_oldp_sales: boolean | null
  has_oldp_pdi: boolean | null
  has_oldp_arrival: boolean | null
  oldp_country: string | null
  oldp_dealer: string | null
  oldp_model_code: string | null
  crm_dealer: string | null
  crm_product_type: string | null
  crm_product_model: string | null
  crm_indent_no: string | null
  crm_end_customer: string | null
  crm_area: string | null
  crm_district: string | null
  crm_region: string | null
  crm_approval_status: string | null
  crm_file_status: string | null
  crm_arrival_date: string | null
  crm_pic: string | null
  arrival_check: string | null
  ms_check_1: string | null
  ms_check_2: string | null
  ms_check_3: string | null
  pdi_check: string | null
  comm_check: string | null
  src_oldp: boolean | null
  src_crm: boolean | null
  src_sales: boolean | null
  src_sju: boolean | null
  src_wo: boolean | null
  src_wo_comm: boolean | null
  src_process: boolean | null
  wo_count: number | null
  sales_count: number | null
  sju_count: number | null
  is_complete_oldp: boolean | null
  is_sdlg_canonical: boolean | null
  master_stage: string | null
  alias_vins: string[] | null
  // Stock / MS from BL
  stock_bl_date: string | null
  stock_end_date: string | null
  stock_status_label: string | null
  stock_age_months: number | null
  stock_age_days: number | null
  stock_duration_text: string | null
  ms1_est_date: string | null
  ms2_est_date: string | null
  ms3_est_date: string | null
  ms4_est_date: string | null
  ms_required_count: number | null
  ms_done_count_oldp: number | null
  ms_gap_count: number | null
  ms_status: string | null
}

export type MasterFilter = 'all' | 'sdlg' | 'complete' | 'gap_ops' | 'ms_gap'

export function parseMasterSearch(raw: string): {
  text: string
  sn6: string | null
  model: string | null
} {
  const text = raw.trim()
  if (!text) return { text: '', sn6: null, model: null }
  const digits = text.replace(/\D/g, '')
  const sn6 = digits.length >= 6 ? digits.slice(-6) : digits.length === 5 ? digits : null
  const modelMatch = text.match(/\b([A-Za-z][A-Za-z0-9-]{2,})\b/)
  const model =
    modelMatch && !/^\d+$/.test(modelMatch[1]) && modelMatch[1].length < 20
      ? modelMatch[1].toUpperCase()
      : null
  return { text, sn6, model }
}

export async function resolveUnitId(
  vin?: string | null,
  model?: string | null,
  serial?: string | null
): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolve_unit_id', {
    p_vin: vin || null,
    p_model: model || null,
    p_serial: serial || null,
  })
  if (error) {
    console.warn('resolve_unit_id', error.message)
    return null
  }
  return (data as string) || null
}

export async function maintainUnitMaster(): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('maintain_unit_master')
  if (error) throw error
  return data as Record<string, unknown>
}
