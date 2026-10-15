import { useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  Truck, ShieldCheck, Eye, EyeOff, Lock, Mail, ArrowRight,
  UserPlus, Building2, MessageSquare, Phone,
} from 'lucide-react'

type Mode = 'login' | 'request'

const CABANG_OPTIONS = [
  'JAKARTA', 'SURABAYA', 'BALIKPAPAN', 'BANJARMASIN', 'SAMARINDA',
  'MAKASSAR', 'MEDAN', 'PALEMBANG', 'PADANG', 'PEKANBARU',
  'PONTIANAK', 'MANADO', 'LAINNYA',
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
  const [cabangLainnya, setCabangLainnya] = useState('')
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
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan autentikasi.')
    } finally {
      setLoading(false)
    }
  }

  const validateRequest = (): string | null => {
    if (fullName.trim().length < 3) return 'Nama lengkap minimal 3 karakter *'
    if (!reqEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reqEmail.trim())) {
      return 'Email tidak valid *'
    }
    if (cabang === 'LAINNYA' && cabangLainnya.trim().length < 2) {
      return 'Isi nama cabang manual (wajib jika pilih LAINNYA) *'
    }
    if (reason.trim().length < 10) return 'Alasan minimal 10 karakter *'
    if (phone.trim() && !/^0\d{8,14}$/.test(phone.trim().replace(/[\s-]/g, ''))) {
      return 'No. HP tidak valid (contoh: 08xxxxxxxxxx)'
    }
    return null
  }

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const v = validateRequest()
    if (v) { setError(v); return }
    setLoading(true)
    try {
      const emailNorm = reqEmail.trim().toLowerCase()
      const cabangFinal = cabang === 'LAINNYA' ? cabangLainnya.trim().toUpperCase() : cabang
      const { data: existingReq } = await supabase
        .from('account_requests')
        .select('id, status')
        .eq('email', emailNorm)
        .eq('status', 'pending')
        .maybeSingle()
      if (existingReq) throw new Error('Email ini sudah punya pengajuan pending. Tunggu review admin.')
      const { error: err } = await supabase.from('account_requests').insert({
        full_name: fullName.trim(),
        email: emailNorm,
        cabang: cabangFinal,
        requested_role: requestedRole,
        reason: reason.trim(),
        phone: phone.trim() || null,
        status: 'pending',
      })
      if (err) throw err
      setSuccess('Pengajuan diterima. Admin akan review. Setelah disetujui, kamu akan di-invite lewat email untuk set password, lalu bisa login.')
      setFullName(''); setReqEmail(''); setReason(''); setPhone(''); setCabangLainnya(''); setCabang('JAKARTA')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim pengajuan.')
    } finally {
      setLoading(false)
    }
  }

  const labelReq = (text: string) => (
    <label className="block text-xs font-semibold uppercase tracking-wider text-surface-400 mb-1.5">
      {text} <span className="text-red-400">*</span>
    </label>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      <div className="w-full max-w-md relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-accent/10 border border-accent/20 text-accent mb-2 shadow-inner">
            <Truck className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-surface-50">SDLG Monitor</h1>
          <p className="text-sm text-surface-400">Portal Pemantauan Populasi Unit</p>
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
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input pl-9" required autoComplete="email" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-surface-400 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="input pl-9 pr-10" required minLength={6} autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <div className="p-3 rounded-lg bg-red-400/10 border border-red-500/20 text-red-400 text-xs">{error}</div>}
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 font-semibold flex items-center justify-center gap-2">
                <span>{loading ? 'Memproses...' : 'Masuk ke Dashboard'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-[10px] text-surface-500 text-center">
                Password dibuat lewat email invite setelah admin approve. Tidak ada daftar password di form pengajuan.
              </p>
            </form>
          ) : (
            <form onSubmit={handleRequest} className="space-y-3">
              <p className="text-[11px] text-surface-500">
                Field bertanda <span className="text-red-400">*</span> wajib diisi. Setelah disetujui, password diatur via email invite.
              </p>
              <div>
                {labelReq('Nama lengkap')}
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input pl-9" required minLength={3} placeholder="Minimal 3 karakter" />
                </div>
              </div>
              <div>
                {labelReq('Email kantor')}
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                  <input type="email" value={reqEmail} onChange={(e) => setReqEmail(e.target.value)} className="input pl-9" required />
                </div>
              </div>
              <div>
                {labelReq('Cabang')}
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                  <select value={cabang} onChange={(e) => setCabang(e.target.value)} className="input pl-9">
                    {CABANG_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {cabang === 'LAINNYA' && (
                  <input type="text" value={cabangLainnya} onChange={(e) => setCabangLainnya(e.target.value)} className="input mt-2" placeholder="Ketik nama cabang *" required minLength={2} />
                )}
              </div>
              <div>
                {labelReq('Role diminta')}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setRequestedRole('operator')} className={`flex-1 py-2 rounded-lg text-xs font-semibold border ${requestedRole === 'operator' ? 'border-accent bg-accent/15 text-accent' : 'border-surface-700 text-surface-400'}`}>Operator</button>
                  <button type="button" onClick={() => setRequestedRole('viewer')} className={`flex-1 py-2 rounded-lg text-xs font-semibold border ${requestedRole === 'viewer' ? 'border-accent bg-accent/15 text-accent' : 'border-surface-700 text-surface-400'}`}>Viewer</button>
                </div>
              </div>
              <div>
                {labelReq('Alasan / keperluan')}
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-surface-500" />
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="input pl-9 min-h-[72px] py-2" placeholder="Minimal 10 karakter" required minLength={10} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-surface-400 mb-1.5">No. HP (opsional)</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input pl-9" placeholder="08xxxxxxxxxx" />
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
      </div>
    </div>
  )
}
