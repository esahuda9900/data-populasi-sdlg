import { useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  Truck,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  UserPlus,
  Building2,
  MessageSquare,
  Phone,
} from 'lucide-react'

type Mode = 'login' | 'request'

const CABANG_OPTIONS = [
  'JAKARTA',
  'SURABAYA',
  'BALIKOPAN',
  'BANJARMASIN',
  'SAMARINDA',
  'MAKASSAR',
  'MEDAN',
  'LAINNYA',
]

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [reqEmail, setReqEmail] = useState('')
  const [cabang, setCabang] = useState('JAKARTA')
  const [requestedRole, setRequestedRole] = useState<'operator' | 'viewer'>('operator')
  const [reason, setReason] = useState('')
  const [phone, setPhone] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan autentikasi.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const { error: err } = await supabase.from('account_requests').insert({
        full_name: fullName.trim(),
        email: reqEmail.trim().toLowerCase(),
        cabang,
        requested_role: requestedRole,
        reason: reason.trim() || null,
        phone: phone.trim() || null,
        status: 'pending',
      })
      if (err) throw err
      setSuccess(
        'Pengajuan kamu sudah diterima. Tunggu konfirmasi dari admin. Setelah di-approve, kamu bisa login.'
      )
      setFullName('')
      setReqEmail('')
      setReason('')
      setPhone('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim pengajuan.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      <div className="w-full max-w-md relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-accent/10 border border-accent/20 text-accent mb-2 shadow-inner">
            <Truck className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-surface-50">SDLG Monitor</h1>
          <p className="text-sm text-surface-400">Portal Pemantauan Populasi Unit, Inspeksi & Berkas Legalitas</p>
        </div>

        <div className="card p-6 sm:p-8 space-y-5 shadow-2xl border-surface-800/80 bg-surface-900/95 backdrop-blur">
          <div className="flex items-center justify-between pb-3 border-b border-surface-800">
            <h2 className="text-base font-semibold text-surface-100">
              {mode === 'login' ? 'Masuk ke Sistem' : 'Ajukan Akses Akun'}
            </h2>
            <span className="text-xs text-accent flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" /> Portal Internal
            </span>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-surface-400 mb-1.5">Alamat Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input pl-9" placeholder="operator@perusahaan.com" required autoComplete="email" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-surface-400 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="input pl-9 pr-10" placeholder="••••••••" required minLength={6} autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <div className="p-3 rounded-lg bg-red-400/10 border border-red-500/20 text-red-400 text-xs">{error}</div>}
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 font-semibold shadow-lg shadow-accent/15 flex items-center justify-center gap-2">
                <span>{loading ? 'Memproses...' : 'Masuk ke Dashboard'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleRequest} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-surface-400 mb-1.5">Nama lengkap</label>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input pl-9" required minLength={2} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-surface-400 mb-1.5">Email kantor</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                  <input type="email" value={reqEmail} onChange={(e) => setReqEmail(e.target.value)} className="input pl-9" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-surface-400 mb-1.5">Cabang</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                  <select value={cabang} onChange={(e) => setCabang(e.target.value)} className="input pl-9">
                    {CABANG_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-surface-400 mb-1.5">Role diminta</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setRequestedRole('operator')} className={`flex-1 py-2 rounded-lg text-xs font-semibold border ${requestedRole === 'operator' ? 'border-accent bg-accent/15 text-accent' : 'border-surface-700 text-surface-400'}`}>Operator</button>
                  <button type="button" onClick={() => setRequestedRole('viewer')} className={`flex-1 py-2 rounded-lg text-xs font-semibold border ${requestedRole === 'viewer' ? 'border-accent bg-accent/15 text-accent' : 'border-surface-700 text-surface-400'}`}>Viewer</button>
                </div>
                <p className="text-[10px] text-surface-500 mt-1">Role Admin tidak bisa diminta lewat form.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-surface-400 mb-1.5">Alasan / keperluan</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-surface-500" />
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="input pl-9 min-h-[72px] py-2" placeholder="Contoh: operator cabang Surabaya" required minLength={5} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-surface-400 mb-1.5">No. HP (opsional)</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input pl-9" placeholder="08xx..." />
                </div>
              </div>
              {error && <div className="p-3 rounded-lg bg-red-400/10 border border-red-500/20 text-red-400 text-xs">{error}</div>}
              {success && <div className="p-3 rounded-lg bg-emerald-400/10 border border-emerald-500/20 text-emerald-400 text-xs">{success}</div>}
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 font-semibold flex items-center justify-center gap-2">
                <span>{loading ? 'Mengirim...' : 'Kirim Pengajuan'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="pt-3 border-t border-surface-800 text-center text-xs text-surface-400">
            {mode === 'login' ? (
              <p>Belum punya akses?{' '}<button type="button" onClick={() => { setMode('request'); setError(null); setSuccess(null) }} className="text-accent hover:underline font-semibold">Ajukan akun di sini</button></p>
            ) : (
              <p>Sudah punya akun aktif?{' '}<button type="button" onClick={() => { setMode('login'); setError(null); setSuccess(null) }} className="text-accent hover:underline font-semibold">Masuk di sini</button></p>
            )}
          </div>
        </div>
        <p className="text-center text-[11px] text-surface-500">SDLG Monitor • Akses hanya setelah disetujui admin</p>
      </div>
    </div>
  )
}
