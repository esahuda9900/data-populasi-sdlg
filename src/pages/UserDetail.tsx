import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { AccountRequest } from '../lib/authProfile'
import {
  adminResetPassword, adminForceLogout, adminSoftDelete, adminRestoreUser, updateProfileOptimistic,
} from '../lib/adminActions'
import {
  ArrowLeft, Copy, Check, Loader2, Pencil, KeyRound, LogOut, Ban, Trash2, RotateCcw, Shield,
} from 'lucide-react'

type DetailRow = {
  id: string; email: string | null; full_name: string; role: string; cabang: string | null
  phone: string | null; is_active: boolean; created_at: string; updated_at: string
  deleted_at: string | null; delete_reason: string | null; email_original: string | null
  last_password_reset_at: string | null; force_logout_at: string | null
  last_sign_in_at: string | null; auth_created_at: string | null
}

export default function UserDetail() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ full_name: '', role: 'viewer', cabang: '', phone: '' })
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteStep, setDeleteStep] = useState(0)
  const [confirmName, setConfirmName] = useState('')

  const { data: user, isLoading, isError, refetch } = useQuery({
    queryKey: ['user_detail', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_user_details').select('*').eq('id', userId!).maybeSingle()
      if (error) throw error
      if (!data) throw new Error('User tidak ditemukan')
      return data as DetailRow
    },
  })

  const { data: requests = [] } = useQuery({
    queryKey: ['user_requests', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('account_requests').select('*').eq('user_id', userId!).order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as AccountRequest[]
    },
  })

  const startEdit = () => {
    if (!user) return
    setForm({ full_name: user.full_name || '', role: user.role, cabang: user.cabang || '', phone: user.phone || '' })
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!user) return
    if (form.full_name.trim().length < 3) { setErr('Nama minimal 3 karakter'); return }
    setBusy(true); setErr(null)
    try {
      await updateProfileOptimistic({
        id: user.id, full_name: form.full_name.trim(), role: form.role,
        cabang: form.cabang, phone: form.phone, expected_updated_at: user.updated_at,
      })
      setMsg('Profil diperbarui'); setEditing(false)
      await queryClient.invalidateQueries({ queryKey: ['user_detail', userId] })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal simpan')
    } finally { setBusy(false) }
  }

  const runAction = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true); setErr(null); setMsg(null)
    try {
      await fn()
      setMsg(okMsg)
      await queryClient.invalidateQueries({ queryKey: ['user_detail', userId] })
      await queryClient.invalidateQueries({ queryKey: ['user_profiles_admin'] })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal')
    } finally { setBusy(false) }
  }

  const copyUuid = () => {
    if (!user) return
    navigator.clipboard.writeText(user.id)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  if (isLoading) return <div className="p-8 flex justify-center text-surface-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
  if (isError || !user) return (
    <div className="p-8 text-center space-y-3">
      <p className="text-red-400">User tidak ditemukan.</p>
      <button type="button" onClick={() => navigate('/akun')} className="btn-secondary text-xs">Kembali</button>
      <button type="button" onClick={() => refetch()} className="btn-secondary text-xs ml-2">Retry</button>
    </div>
  )

  const isDeleted = !!user.deleted_at

  return (
    <div className="space-y-6 max-w-2xl">
      <Link to="/akun" className="inline-flex items-center gap-1.5 text-xs text-surface-400 hover:text-accent">
        <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Account Management
      </Link>
      {msg && <div className="p-3 rounded-lg bg-emerald-400/10 border border-emerald-500/20 text-emerald-400 text-xs">{msg}</div>}
      {err && <div className="p-3 rounded-lg bg-red-400/10 border border-red-500/20 text-red-400 text-xs">{err}</div>}

      <div className="card border-surface-800 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold">
            {(user.full_name || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-surface-50">{user.full_name}</h1>
            <p className="text-sm text-surface-400 break-all">{user.email_original || user.email}</p>
            <p className="text-[10px] font-mono text-surface-500 mt-1 flex items-center gap-1 flex-wrap">
              UUID: {user.id}
              <button type="button" onClick={copyUuid} className="text-accent">{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}</button>
            </p>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
            isDeleted ? 'text-red-400 border-red-500/30 bg-red-500/10' : user.is_active ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
          }`}>{isDeleted ? 'Arsip' : user.is_active ? 'Aktif' : 'Nonaktif'}</span>
        </div>

        {!editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Info label="Role" value={user.role} />
            <Info label="Cabang" value={user.cabang || '—'} />
            <Info label="No. HP" value={user.phone || '—'} />
            <Info label="Login terakhir" value={user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('id-ID') : 'Belum pernah login'} />
            <Info label="Terdaftar" value={new Date(user.created_at).toLocaleString('id-ID')} />
            <Info label="Update terakhir" value={new Date(user.updated_at).toLocaleString('id-ID')} />
            {user.last_password_reset_at && <Info label="Reset password terakhir" value={new Date(user.last_password_reset_at).toLocaleString('id-ID')} />}
            {isDeleted && (
              <>
                <Info label="Dihapus" value={new Date(user.deleted_at!).toLocaleString('id-ID')} />
                <Info label="Alasan hapus" value={user.delete_reason || '—'} />
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <input className="input text-sm" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Nama *" />
            <select className="input text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="admin">admin</option>
              <option value="operator">operator</option>
              <option value="viewer">viewer</option>
            </select>
            <input className="input text-sm" value={form.cabang} onChange={(e) => setForm({ ...form, cabang: e.target.value })} placeholder="Cabang" />
            <input className="input text-sm" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="No. HP" />
            <p className="text-[10px] text-surface-500">Email readonly (dari Auth).</p>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={saveEdit} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Simpan</button>
              <button type="button" onClick={() => setEditing(false)} className="text-xs text-surface-400 px-2">Batal</button>
            </div>
          </div>
        )}

        {!isDeleted && !editing && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-800">
            <ActionBtn icon={<Pencil className="w-3 h-3" />} label="Edit" onClick={startEdit} />
            <ActionBtn icon={<KeyRound className="w-3 h-3" />} label="Reset Password" disabled={busy}
              onClick={() => runAction(() => adminResetPassword(user.id, window.location.origin + '/'), 'Email reset password dikirim')} />
            <ActionBtn icon={<LogOut className="w-3 h-3" />} label="Force Logout" disabled={busy}
              onClick={() => { if (!window.confirm('Paksa logout semua device user ini?')) return; runAction(() => adminForceLogout(user.id), 'Semua session di-revoke') }} />
            <ActionBtn icon={<Ban className="w-3 h-3" />} label={user.is_active ? 'Nonaktifkan' : 'Aktifkan'} disabled={busy}
              onClick={async () => {
                setBusy(true); setErr(null)
                try {
                  const { error } = await supabase.from('user_profiles').update({ is_active: !user.is_active }).eq('id', user.id)
                  if (error) throw error
                  setMsg(user.is_active ? 'User dinonaktifkan' : 'User diaktifkan')
                  await queryClient.invalidateQueries({ queryKey: ['user_detail', userId] })
                } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Gagal') }
                finally { setBusy(false) }
              }} />
            <ActionBtn icon={<Trash2 className="w-3 h-3" />} label="Hapus Akun" danger disabled={busy} onClick={() => setDeleteStep(1)} />
          </div>
        )}

        {isDeleted && (
          <div className="pt-2 border-t border-surface-800">
            <ActionBtn icon={<RotateCcw className="w-3 h-3" />} label="Restore dari Arsip" disabled={busy}
              onClick={() => { if (!window.confirm('Restore user ini?')) return; runAction(() => adminRestoreUser(user.id), 'User di-restore') }} />
          </div>
        )}

        {deleteStep > 0 && !isDeleted && (
          <div className="mt-3 p-3 rounded-lg border border-red-500/30 bg-red-500/5 space-y-2">
            {deleteStep === 1 && (
              <>
                <p className="text-xs text-red-300">Yakin soft-delete akun <strong>{user.full_name}</strong>?</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDeleteStep(2)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">Lanjut</button>
                  <button type="button" onClick={() => setDeleteStep(0)} className="text-xs text-surface-400">Batal</button>
                </div>
              </>
            )}
            {deleteStep === 2 && (
              <>
                <p className="text-xs text-surface-300">Ketik nama user: <strong>{user.full_name}</strong></p>
                <input className="input text-xs" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
                <div className="flex gap-2">
                  <button type="button" disabled={confirmName !== user.full_name} onClick={() => setDeleteStep(3)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 disabled:opacity-40">Lanjut</button>
                  <button type="button" onClick={() => setDeleteStep(0)} className="text-xs text-surface-400">Batal</button>
                </div>
              </>
            )}
            {deleteStep === 3 && (
              <>
                <p className="text-xs text-surface-300">Alasan hapus (min 10 karakter)</p>
                <textarea className="input text-xs min-h-[60px]" value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} />
                <div className="flex gap-2">
                  <button type="button" disabled={busy || deleteReason.trim().length < 10}
                    onClick={() => { runAction(() => adminSoftDelete(user.id, deleteReason.trim()), 'User masuk arsip (soft delete)').then(() => { setDeleteStep(0); setDeleteReason(''); setConfirmName('') }) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 disabled:opacity-40">Konfirmasi Hapus</button>
                  <button type="button" onClick={() => setDeleteStep(0)} className="text-xs text-surface-400">Batal</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="card border-surface-800 p-4 space-y-2">
        <h2 className="text-sm font-semibold text-surface-200 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-accent" /> Riwayat Request ({requests.length})
        </h2>
        {requests.length === 0 ? (
          <p className="text-xs text-surface-500">Tidak ada request terkait.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="text-xs border border-surface-800 rounded-lg px-3 py-2 text-surface-300">
                {new Date(r.created_at).toLocaleString('id-ID')} — <span className="text-accent">{r.status}</span>
                {r.requested_role ? ` · minta ${r.requested_role}` : ''}
                {r.rejection_reason ? ` · ${r.rejection_reason}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-surface-500">{label}</p>
      <p className="text-surface-200 text-sm">{value}</p>
    </div>
  )
}

function ActionBtn({ icon, label, onClick, disabled, danger }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border disabled:opacity-40 ${
        danger ? 'border-red-500/30 text-red-400 bg-red-500/10' : 'border-surface-700 text-surface-300'
      }`}>{icon}{label}</button>
  )
}
