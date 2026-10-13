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
  year_delivery: number | null
  location: string | null
  under_cabang: string | null
  customer: string | null
  customer_update: string | null
  marketing_status: string | null
  stock_status: string | null
  status: string
  device_number: string | null
  created_at: string
  updated_at: string
}

export type UnitProcess = {
  id: string
  vin: string | null
  unit_number?: string | null
  arrival_check: string | null
  pdi_check: string | null
  comm_check: string | null
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

export type UnitWithProcess = Unit & {
  process?: UnitProcess | null
}
