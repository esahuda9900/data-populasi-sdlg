import { supabase } from './supabase'

export type UserRole = 'admin' | 'operator' | 'viewer'

export type UserProfile = {
  id: string
  email?: string | null
  full_name: string
  role: UserRole
  cabang: string | null
  phone: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
  deleted_by?: string | null
  delete_reason?: string | null
  email_original?: string | null
  last_password_reset_at?: string | null
  force_logout_at?: string | null
}

export type AccountRequest = {
  id: string
  full_name: string
  email: string
  cabang: string | null
  requested_role: 'operator' | 'viewer'
  reason: string | null
  phone: string | null
  status: 'pending' | 'approved' | 'rejected'
  user_id?: string | null
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export async function fetchMyProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, role, cabang, phone, is_active, created_at, updated_at, deleted_at')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !data) return null
  if (!data.is_active || data.deleted_at) return null
  return data as UserProfile
}

export function canEdit(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'operator'
}

export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === 'admin'
}

export function canUseAi(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'operator'
}

export function canBulkImport(role: UserRole | null | undefined): boolean {
  return role === 'admin'
}
