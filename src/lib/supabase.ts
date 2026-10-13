import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Unit = {
  id: string
  unit_number: string
  model: string | null
  serial_number: string | null
  year: number | null
  location: string | null
  status: 'aktif' | 'idle' | 'maintenance' | 'sold' | 'scrapped'
  operator: string | null
  operating_hours: number | null
  customer: string | null
  notes: string | null
  created_at: string
  updated_at: string
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
  expires_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  document_types?: DocumentType
  units?: Unit
}