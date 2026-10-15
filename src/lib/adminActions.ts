import { supabase } from './supabase'

const FN = 'admin-user-actions'

async function callAdminAction(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Session tidak valid')

  const { data, error } = await supabase.functions.invoke(FN, {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (error) throw new Error(error.message || 'Edge function error')
  if (data?.error) throw new Error(data.error)
  return data
}

export async function adminResetPassword(userId: string, redirectTo?: string) {
  return callAdminAction({ action: 'reset_password', user_id: userId, redirect_to: redirectTo })
}

export async function adminForceLogout(userId: string) {
  return callAdminAction({ action: 'force_logout', user_id: userId })
}

export async function adminSoftDelete(userId: string, reason: string) {
  return callAdminAction({ action: 'soft_delete', user_id: userId, reason })
}

export async function adminRestoreUser(userId: string) {
  return callAdminAction({ action: 'restore', user_id: userId })
}

export async function updateProfileOptimistic(opts: {
  id: string
  full_name: string
  role: string
  cabang: string
  phone: string
  expected_updated_at: string
}) {
  const { data, error } = await supabase.rpc('update_user_profile_optimistic', {
    p_id: opts.id,
    p_full_name: opts.full_name,
    p_role: opts.role,
    p_cabang: opts.cabang,
    p_phone: opts.phone,
    p_expected_updated_at: opts.expected_updated_at,
  })
  if (error) throw error
  if (!data) throw new Error('Data sudah diubah admin lain. Refresh dulu.')
  return data as string
}
