import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Truck, ShieldCheck, Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setError('Pendaftaran berhasil. Silakan cek email Anda untuk verifikasi.')
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan autentikasi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4 py-12 relative overflow-hidden">
      {/* Background radial highlight */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-accent/10 border border-accent/20 text-accent mb-2 shadow-inner">
            <Truck className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-surface-50">
            SDLG Monitor
          </h1>
          <p className="text-sm text-surface-400">
            Portal Pemantauan Populasi Unit, Inspeksi & Berkas Legalitas
          </p>
        </div>

        {/* Auth Card */}
        <div className="card p-6 sm:p-8 space-y-5 shadow-2xl border-surface-800/80 bg-surface-900/95 backdrop-blur">
          <div className="flex items-center justify-between pb-3 border-b border-surface-800">
            <h2 className="text-base font-semibold text-surface-100">
              {mode === 'login' ? 'Masuk ke Sistem' : 'Daftar Akun Baru'}
            </h2>
            <span className="text-xs text-accent flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" /> Portal Internal
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-surface-400 mb-1.5">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-9"
                  placeholder="operator@perusahaan.com"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-surface-400">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-9 pr-10"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-400/10 border border-red-500/20 text-red-400 text-xs leading-relaxed">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 font-semibold shadow-lg shadow-accent/15 flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Memproses...' : mode === 'login' ? 'Masuk ke Dashboard' : 'Buat Akun'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-3 border-t border-surface-800 text-center text-xs text-surface-400">
            {mode === 'login' ? (
              <p>
                Belum terdaftar sebagai operator?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup')
                    setError(null)
                  }}
                  className="text-accent hover:underline font-semibold"
                >
                  Registrasi di sini
                </button>
              </p>
            ) : (
              <p>
                Sudah memiliki akses terdaftar?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setError(null)
                  }}
                  className="text-accent hover:underline font-semibold"
                >
                  Masuk di sini
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Security & System Note */}
        <p className="text-center text-[11px] text-surface-500">
          SDLG Heavy Machinery Population Monitor • Enkripsi Sesi Aktif
        </p>
      </div>
    </div>
  )
}