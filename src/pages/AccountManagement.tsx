import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { AccountRequest } from '../lib/authProfile'
import { CheckCircle2, XCircle, Clock, RefreshCw, Shield, UserCheck } from 'lucide-react'

type Filter = 'pending' | 'approved' | 'rejected' | 'all'

export default function AccountManagement() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('pending')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [editRole, setEditRole] = useState<Record<string, 'operator' | 'viewer'>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: requests = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['account_requests'],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('account_requests')
        .select('*')
        .order('created_at', { ascending: false })
      if (err) throw err
      return (data || []) as AccountRequest[]
    },
  })

  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter)

  const handleApprove = async (req: AccountRequest) => {
    setBusyId(req.id)
    setError(null)
    setMessage(null)
    try {
      const role = editRole[req.id] || req.requested_role
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Session admin tidak valid')
      const { error: upErr } = await supabase
        .from('account_requests')
        .update({
          status: 'approved',
          requested_role: role,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', req.id)
      if (upErr) throw upErr
      setMessage(
        `Request ${req.email} di-approve (role: ${role}). Buat user di Supabase Auth (Invite) dengan email tersebut, lalu insert user_profiles.`
      )
      await queryClient.invalidateQueries({ queryKey: ['account_requests'] })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal approve')
    } finally {
      setBusyId(null)
    }
  }

  const handleReject = async (req: AccountRequest) => {
    if (!rejectReason.trim()) {
      setError('Alasan penolakan wajib diisi')
      return
    }
    setBusyId(req.id)
    setError(null)
    setMessage(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error: upErr } = await supabase
        .from('account_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejectReason.trim(),
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', req.id)
      if (upErr) throw upErr
      setRejectId(null)
      setRejectReason('')
      setMessage(`Request ${req.email} ditolak.`)
      await queryClient.invalidateQueries({ queryKey: ['account_requests'] })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal reject')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-50 flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            Account Management
            {pendingCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                {pendingCount} pending
              </span>
            )}
          </h1>
          <p className="text-sm text-surface-400 mt-1">Review pengajuan akun (admin only).</p>
        </div>
        <button type="button" onClick={() => refetch()} className="btn-secondary text-xs flex items-center gap-1.5 self-start">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {message && <div className="p-3 rounded-lg bg-emerald-400/10 border border-emerald-500/20 text-emerald-400 text-xs">{message}</div>}
      {error && <div className="p-3 rounded-lg bg-red-400/10 border border-red-500/20 text-red-400 text-xs">{error}</div>}

      <div className="flex flex-wrap gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as Filter[]).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            filter === f ? 'border-accent bg-accent/15 text-accent' : 'border-surface-700 text-surface-400'
          }`}>{f === 'all' ? 'Semua' : f}</button>
        ))}
      </div>

      <div className="card border-surface-800 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-surface-400 text-sm">Memuat...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-surface-500 text-sm">Tidak ada request.</div>
        ) : (
          <ul className="divide-y divide-surface-800">
            {filtered.map((req) => (
              <li key={req.id} className="p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-surface-100">{req.full_name}</p>
                    <p className="text-xs text-surface-400">{req.email}</p>
                    <p className="text-[11px] text-surface-500 mt-1">
                      Cabang: {req.cabang || '—'} · Minta: {req.requested_role} · {new Date(req.created_at).toLocaleString('id-ID')}
                    </p>
                    {req.reason && <p className="text-xs text-surface-300 mt-2 bg-surface-950/50 rounded-lg p-2 border border-surface-800">{req.reason}</p>}
                    {req.status === 'rejected' && req.rejection_reason && <p className="text-xs text-red-400 mt-1">Tolak: {req.rejection_reason}</p>}
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
                    {rejectId === req.id ? (
                      <div className="flex flex-1 flex-col sm:flex-row gap-2">
                        <input className="input text-xs py-1.5 flex-1" placeholder="Alasan penolakan (wajib)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                        <button type="button" disabled={busyId === req.id} onClick={() => handleReject(req)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">Konfirmasi tolak</button>
                        <button type="button" onClick={() => { setRejectId(null); setRejectReason('') }} className="text-xs text-surface-400 px-2">Batal</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setRejectId(req.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
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
        <p className="font-semibold text-surface-400">Setelah approve:</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>Supabase → Authentication → Invite user (email request)</li>
          <li>SQL insert user_profiles dengan id dari auth.users + role</li>
          <li>User set password dari email invite, lalu login</li>
        </ol>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending') return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> pending</span>
  if (status === 'approved') return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> approved</span>
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> rejected</span>
}
