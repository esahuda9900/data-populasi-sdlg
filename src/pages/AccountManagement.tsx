import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { AccountRequest, UserProfile } from '../lib/authProfile'
import {
  CheckCircle2, XCircle, Clock, RefreshCw, Shield, UserCheck,
  Users, Inbox, Pencil, Ban, Loader2,
} from 'lucide-react'

type Filter = 'pending' | 'approved' | 'rejected' | 'all'
type Tab = 'requests' | 'users'
type ProfileRow = UserProfile & { email?: string | null }

export default function AccountManagement() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('requests')
  const [filter, setFilter] = useState<Filter>('pending')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<Record<string, 'operator' | 'viewer'>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<ProfileRow | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', role: 'viewer' as string, cabang: '' })

  const { data: requests = [], isLoading: loadingReq, isError: errReq, refetch: refetchReq, isFetching: fetchingReq } = useQuery({
    queryKey: ['account_requests'],
    queryFn: async () => {
      const { data, error: err } = await supabase.from('account_requests').select('*').order('created_at', { ascending: false })
      if (err) throw err
      return (data || []) as AccountRequest[]
    },
  })

  const { data: users = [], isLoading: loadingUsers, isError: errUsers, refetch: refetchUsers, isFetching: fetchingUsers } = useQuery({
    queryKey: ['user_profiles_admin'],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('user_profiles')
        .select('id, full_name, role, cabang, phone, is_active, created_at, updated_at')
        .order('created_at', { ascending: false })
      if (err) throw err
      return (data || []) as ProfileRow[]
    },
  })

  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const filtered = (filter === 'all' ? requests : requests.filter((r) => r.status === filter)).filter((r) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return r.full_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || (r.cabang || '').toLowerCase().includes(q)
  })
  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return u.full_name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q) || (u.cabang || '').toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
  })

  const handleApprove = async (req: AccountRequest) => {
    setBusyId(req.id); setError(null); setMessage(null)
    try {
      const role = editRole[req.id] || req.requested_role
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Session admin tidak valid')
      const { data: current } = await supabase.from('account_requests').select('status').eq('id', req.id).maybeSingle()
      if (!current || current.status !== 'pending') throw new Error('Request sudah diproses. Refresh halaman.')
      const { error: upErr } = await supabase.from('account_requests').update({
        status: 'approved', requested_role: role, reviewed_by: user.id, reviewed_at: new Date().toISOString(),
      }).eq('id', req.id).eq('status', 'pending')
      if (upErr) throw upErr

      const profileId = req.user_id || null
      if (profileId) {
        const { error: profErr } = await supabase.from('user_profiles').update({
          is_active: true,
          role,
          full_name: req.full_name,
          cabang: req.cabang || null,
          updated_at: new Date().toISOString(),
        }).eq('id', profileId)
        if (profErr) throw new Error('Request approved, tapi gagal aktifkan profile: ' + profErr.message)
      }

      setMessage(
        profileId
          ? `Approved & aktif: ${req.email} (role: ${role}). User bisa login dengan password yang didaftarkan.`
          : `Approved: ${req.email}. Profile belum ter-link (user_id kosong). Aktifkan manual di tab Users.`
      )
      await queryClient.invalidateQueries({ queryKey: ['account_requests'] })
      await queryClient.invalidateQueries({ queryKey: ['user_profiles_admin'] })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal approve')
    } finally { setBusyId(null) }
  }

  const startReject = (req: AccountRequest) => {
    if (!window.confirm(`Yakin tolak pengajuan ${req.full_name} (${req.email})?`)) return
    setRejectConfirmId(req.id); setRejectId(req.id); setRejectReason('')
  }

  const handleReject = async (req: AccountRequest) => {
    if (rejectReason.trim().length < 10) { setError('Alasan penolakan minimal 10 karakter'); return }
    setBusyId(req.id); setError(null); setMessage(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error: upErr } = await supabase.from('account_requests').update({
        status: 'rejected', rejection_reason: rejectReason.trim(), reviewed_by: user?.id || null, reviewed_at: new Date().toISOString(),
      }).eq('id', req.id).eq('status', 'pending')
      if (upErr) throw upErr
      setRejectId(null); setRejectConfirmId(null); setRejectReason('')
      setMessage(`Request ${req.email} ditolak.`)
      await queryClient.invalidateQueries({ queryKey: ['account_requests'] })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal reject')
    } finally { setBusyId(null) }
  }

  const openEditUser = (u: ProfileRow) => {
    setEditingUser(u)
    setEditForm({ full_name: u.full_name || '', role: u.role, cabang: u.cabang || '' })
  }

  const saveUser = async () => {
    if (!editingUser) return
    setBusyId(editingUser.id); setError(null)
    try {
      if (editForm.full_name.trim().length < 2) throw new Error('Nama minimal 2 karakter')
      if (!['admin', 'operator', 'viewer'].includes(editForm.role)) throw new Error('Role tidak valid')
      const { error: upErr } = await supabase.from('user_profiles').update({
        full_name: editForm.full_name.trim(), role: editForm.role, cabang: editForm.cabang.trim() || null, updated_at: new Date().toISOString(),
      }).eq('id', editingUser.id)
      if (upErr) throw upErr
      setMessage(`User ${editForm.full_name} diperbarui.`); setEditingUser(null)
      await queryClient.invalidateQueries({ queryKey: ['user_profiles_admin'] })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal simpan user')
    } finally { setBusyId(null) }
  }

  const toggleActive = async (u: ProfileRow) => {
    const next = !u.is_active
    const label = next ? 'aktifkan' : 'nonaktifkan'
    if (!window.confirm(`Yakin ${label} akun ${u.full_name}?`)) return
    setBusyId(u.id); setError(null)
    try {
      const { error: upErr } = await supabase.from('user_profiles').update({ is_active: next, updated_at: new Date().toISOString() }).eq('id', u.id)
      if (upErr) throw upErr
      setMessage(`User ${u.full_name} di-${label}.`)
      await queryClient.invalidateQueries({ queryKey: ['user_profiles_admin'] })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal update status')
    } finally { setBusyId(null) }
  }

  const reviewerLabel = (req: AccountRequest) => {
    if (!req.reviewed_at) return null
    const when = new Date(req.reviewed_at).toLocaleString('id-ID')
    const action = req.status === 'approved' ? 'Di-approve' : 'Di-reject'
    return (
      <p className="text-[11px] text-surface-500 mt-1">
        {action} oleh <span className="font-mono">{req.reviewed_by?.slice(0, 8)}…</span> pada {when}
        {req.status === 'rejected' && req.rejection_reason && (
          <> · Alasan: <span className="text-red-400">{req.rejection_reason}</span></>
        )}
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-50 flex items-center gap-2 flex-wrap">
            <Shield className="w-5 h-5 text-accent" /> Account Management
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">{pendingCount} pending</span>
            )}
          </h1>
          <p className="text-sm text-surface-400 mt-1">Kelola pengajuan & user aktif (admin).</p>
        </div>
        <button type="button" onClick={() => (tab === 'requests' ? refetchReq() : refetchUsers())} className="btn-secondary text-xs flex items-center gap-1.5 self-start">
          <RefreshCw className={`w-3.5 h-3.5 ${fetchingReq || fetchingUsers ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {message && <div className="p-3 rounded-lg bg-emerald-400/10 border border-emerald-500/20 text-emerald-400 text-xs leading-relaxed">{message}</div>}
      {error && <div className="p-3 rounded-lg bg-red-400/10 border border-red-500/20 text-red-400 text-xs">{error}</div>}

      <div className="flex gap-2 border-b border-surface-800 pb-2">
        <button type="button" onClick={() => setTab('requests')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === 'requests' ? 'bg-accent/15 text-accent' : 'text-surface-400'}`}>
          <Inbox className="w-3.5 h-3.5" /> Requests
        </button>
        <button type="button" onClick={() => setTab('users')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === 'users' ? 'bg-accent/15 text-accent' : 'text-surface-400'}`}>
          <Users className="w-3.5 h-3.5" /> Users
        </button>
      </div>

      <input className="input text-sm max-w-md" placeholder="Cari nama / email / UUID / cabang..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {tab === 'requests' && (
        <>
          <div className="flex flex-wrap gap-2">
            {(['pending', 'approved', 'rejected', 'all'] as Filter[]).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                filter === f ? 'border-accent bg-accent/15 text-accent' : 'border-surface-700 text-surface-400'
              }`}>{f === 'all' ? 'Semua' : f}</button>
            ))}
          </div>
          <div className="card border-surface-800 overflow-x-auto">
            {loadingReq ? (
              <div className="p-8 flex flex-col items-center gap-2 text-surface-400 text-sm"><Loader2 className="w-5 h-5 animate-spin" /> Memuat requests...</div>
            ) : errReq ? (
              <div className="p-8 text-center space-y-2"><p className="text-red-400 text-sm">Gagal memuat data.</p><button type="button" onClick={() => refetchReq()} className="btn-secondary text-xs">Coba lagi</button></div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-surface-500 text-sm">Tidak ada request.</div>
            ) : (
              <ul className="divide-y divide-surface-800 min-w-[320px]">
                {filtered.map((req) => (
                  <li key={req.id} className="p-4 sm:p-5 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-surface-100">{req.full_name}</p>
                        <p className="text-xs text-surface-400 break-all">{req.email}</p>
                        <p className="text-[10px] font-mono text-surface-600 mt-0.5">id: {req.id}</p>
                        <p className="text-[11px] text-surface-500 mt-1">Cabang: {req.cabang || '—'} · Minta: {req.requested_role} · {new Date(req.created_at).toLocaleString('id-ID')}</p>
                        {req.reason && <p className="text-xs text-surface-300 mt-2 bg-surface-950/50 rounded-lg p-2 border border-surface-800">{req.reason}</p>}
                        {reviewerLabel(req)}
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                    {req.status === 'pending' && (
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-center pt-1">
                        <select className="input text-xs py-1.5 max-w-[140px]" value={editRole[req.id] || req.requested_role} onChange={(e) => setEditRole((prev) => ({ ...prev, [req.id]: e.target.value as 'operator' | 'viewer' }))}>
                          <option value="operator">operator</option>
                          <option value="viewer">viewer</option>
                        </select>
                        <button type="button" disabled={busyId === req.id} onClick={() => handleApprove(req)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <UserCheck className="w-3.5 h-3.5" /> Approve
                        </button>
                        {rejectId === req.id && rejectConfirmId === req.id ? (
                          <div className="flex flex-1 flex-col sm:flex-row gap-2">
                            <input className="input text-xs py-1.5 flex-1" placeholder="Alasan penolakan min 10 karakter" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                            <button type="button" disabled={busyId === req.id} onClick={() => handleReject(req)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">Konfirmasi tolak</button>
                            <button type="button" onClick={() => { setRejectId(null); setRejectConfirmId(null); setRejectReason('') }} className="text-xs text-surface-400 px-2">Batal</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => startReject(req)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="text-[11px] text-surface-500 border border-surface-800 rounded-lg p-3 bg-surface-900/50 space-y-1">
            <p className="font-semibold text-surface-400">Alur signup (baru):</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>User daftar (email + password + form profil)</li>
              <li>Profile otomatis is_active=false → menunggu approve</li>
              <li>Admin Approve → profile diaktifkan, user langsung bisa login</li>
            </ol>
          </div>
        </>
      )}

      {tab === 'users' && (
        <div className="card border-surface-800 overflow-x-auto">
          {loadingUsers ? (
            <div className="p-8 flex flex-col items-center gap-2 text-surface-400 text-sm"><Loader2 className="w-5 h-5 animate-spin" /> Memuat users...</div>
          ) : errUsers ? (
            <div className="p-8 text-center space-y-2"><p className="text-red-400 text-sm">Gagal memuat users.</p><button type="button" onClick={() => refetchUsers()} className="btn-secondary text-xs">Coba lagi</button></div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-surface-500 text-sm">Tidak ada user.</div>
          ) : (
            <ul className="divide-y divide-surface-800 min-w-[320px]">
              {filteredUsers.map((u) => (
                <li key={u.id} className="p-4 sm:p-5 space-y-2">
                  {editingUser?.id === u.id ? (
                    <div className="space-y-2">
                      <input className="input text-sm" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} placeholder="Nama" />
                      <div className="flex flex-wrap gap-2">
                        <select className="input text-xs py-1.5" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                          <option value="admin">admin</option>
                          <option value="operator">operator</option>
                          <option value="viewer">viewer</option>
                        </select>
                        <input className="input text-xs py-1.5 flex-1 min-w-[120px]" value={editForm.cabang} onChange={(e) => setEditForm({ ...editForm, cabang: e.target.value })} placeholder="Cabang" />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" disabled={busyId === u.id} onClick={saveUser} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Simpan</button>
                        <button type="button" onClick={() => setEditingUser(null)} className="text-xs text-surface-400 px-2">Batal</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-surface-100">{u.full_name}</p>
                        <p className="text-[10px] font-mono text-surface-500 break-all">UUID: {u.id}</p>
                        <p className="text-[11px] text-surface-400 mt-1">
                          Role: <span className="text-accent">{u.role}</span> · Cabang: {u.cabang || '—'} ·{' '}
                          {u.is_active ? <span className="text-emerald-400">aktif</span> : <span className="text-red-400">nonaktif</span>}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => openEditUser(u)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] border border-surface-700 text-surface-300"><Pencil className="w-3 h-3" /> Edit</button>
                        <button type="button" disabled={busyId === u.id} onClick={() => toggleActive(u)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] border border-surface-700 text-surface-300">
                          <Ban className="w-3 h-3" />{u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending') return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> pending</span>
  if (status === 'approved') return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-500/20 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> approved</span>
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400 bg-red-400/10 border border-red-500/20 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> rejected</span>
}
