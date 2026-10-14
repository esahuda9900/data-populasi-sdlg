import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xluokufxwxurjykfrjav.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsdW9rdWZ4d3h1cmp5a2ZyamF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NzY5NDYsImV4cCI6MjEwNzQ1Mjk0Nn0.TtOVcTu2GubH4UNmCNr6uczTqGPmlFqEMm6B5PxNc88'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Unit = {
  id: string
  vin: string | null
  unit_number: string
  serial_number: string | null
  model: string | null
  group_type: string | null
  variant: string | null
  year: number | null
  year_delivery: number | null
  location: string | null
  under_cabang: string | null
  customer: string | null
  customer_update: string | null
  marketing_status: string | null
  stock_status: string | null
  stock_duration_m: number | null
  status: string
  operator: string | null
  operating_hours: number | null
  notes: string | null
  device_number: string | null
  no_regist: string | null
  bill_of_lading: string | null
  bl_date: string | null
  created_at: string
  updated_at: string
}

export type UnitProcess = {
  id: string
  unit_id?: string | null
  vin: string | null
  unit_number?: string | null
  arrival_check: string | null
  ms_check_1?: string | null
  ms_check_2?: string | null
  ms_check_3?: string | null
  pdi_check: string | null
  comm_check: string | null
  pdi_date?: string | null
  arrival_date?: string | null
  leadtime_ai_pdi?: number | null
  ms_stock_wajib?: string | null
  pdi_wajib?: string | null
  data_validity_check?: string | null
  remind_limit_day?: number | null
  created_at?: string
  updated_at?: string
}

export type DocumentType = {
  id: string
  code: string
  name: string
  description: string | null
  is_required: boolean
  sort_order: number
}

export type UnitDocument = {
  id: string
  unit_id: string
  document_type_id: string
  status: 'missing' | 'pending' | 'uploaded' | 'expired' | 'rejected'
  file_url: string | null
  file_name: string | null
  uploaded_at: string | null
  notes: string | null
  document_types?: DocumentType | null
  units?: Unit | null
}

export type UnitSales = {
  id: string
  unit_id: string | null
  vin: string | null
  invoice_sales: string | null
  salesman: string | null
  branch_sales: string | null
  ldp: string | null
  sales_month: string | null
  filter_interval: string | null
  oil_interval: string | null
  service_interval: string | null
  customer_phone: string | null
  created_at?: string
}

export type UnitDelivery = {
  id: string
  unit_id: string | null
  vin: string | null
  brand: string | null
  tipe_unit: string | null
  customer_cabang: string | null
  pick_up_point: string | null
  delivery_point: string | null
  berangkat_date: string | null
  sampai_date: string | null
  forwarder: string | null
  harga: number | null
  cabang: string | null
  created_at?: string
}

export type WorkOrder = {
  id: string
  unit_id: string | null
  vin: string | null
  case_number: string | null
  case_group: string | null
  type: string | null
  status: string | null
  description: string | null
  device_name: string | null
  delivery_name: string | null
  custodian: string | null
  customer_account: string | null
  device_number: string | null
  person_in_charge: string | null
  primary_resource: string | null
  start_date: string | null
  estimated_hours: number | null
  created_at?: string
}

export type CrmRecord = {
  id: string
  unit_id: string | null
  vin: string | null
  dealer: string | null
  product_type: string | null
  product_model: string | null
  indent_no: string | null
  end_customer_name: string | null
  area: string | null
  district: string | null
  approval_status: string | null
  file_status: string | null
  arrival_date: string | null
  sales_date_dealer: string | null
  sales_date_end_customer: string | null
  warranty_start_date: string | null
  out_of_warranty_critical: string | null
  out_of_warranty_other: string | null
  person_in_charge: string | null
  region: string | null
  created_at?: string
}

export type UnitOldpFlags = {
  vin: string
  bl_date: string | null
  arrival_date: string | null
  pdi_date: string | null
  sales_date: string | null
  ms1_date: string | null
  ms2_date: string | null
  ms3_date: string | null
  has_sales: boolean | null
  has_pdi: boolean | null
  has_arrival: boolean | null
  has_ms1: boolean | null
  has_ms2: boolean | null
  has_ms3: boolean | null
  refreshed_at: string | null
  // optional raw OLDP fields when joined from staging
  country_name?: string | null
  dealer_name?: string | null
  model_code?: string | null
}

export type AuditLog = {
  id: string
  table_name: string
  record_id: string | null
  unit_id: string | null
  field_name: string | null
  old_value: string | null
  new_value: string | null
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  source: 'manual' | 'ai' | 'import' | 'system'
  changed_by: string | null
  created_at: string
}

export type UnitWithProcess = Unit & {
  process?: UnitProcess | null
}
