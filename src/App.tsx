import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NetworkStatus } from './components/NetworkStatus'
import { Skeleton } from './components/Skeleton'
import { fetchMyProfile, UserProfile } from './lib/authProfile'

const Login = lazy(() => import('./pages/Login'))
const MasterUnit = lazy(() => import('./pages/MasterUnit'))
const Sales = lazy(() => import('./pages/Sales'))
const Departures = lazy(() => import('./pages/Departures'))
const Commissioning = lazy(() => import('./pages/Commissioning'))
const AnalisaMasalah = lazy(() => import('./pages/AnalisaMasalah'))
const AccountManagement = lazy(() => import('./pages/AccountManagement'))

function RouteFallback() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  )
}

function InactiveGate({ email, onLogout }: { email?: string; onLogout: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      <div className="card p-8 max-w-md w-full space-y-4 text-center border-surface-800">
        <h1 className="text-lg font-semibold text-surface-50">Akun belum diaktifkan</h1>
        <p className="text-sm text-surface-400 leading-relaxed">
          {email ? (
            <>
              Login berhasil untuk <span className="text-surface-200">{email}</span>, tetapi profil
              belum aktif atau belum di-approve admin.
            </>
          ) : (
            <>Login berhasil, tetapi profil belum aktif atau belum di-approve admin.</>
          )}
        </p>
        <p className="text-xs text-surface-500">
          Ajukan akses lewat form di halaman login, atau hubungi admin ITU.
        </p>
        <button type="button" onClick={onLogout} className="btn-primary w-full py-2.5">
          Keluar & kembali ke Login
        </button>
      </div>
    </div>
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileChecked, setProfileChecked] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async (sess: Session | null) => {
      if (!sess) {
        if (!cancelled) {
          setSession(null)
          setProfile(null)
          setProfileChecked(true)
          setLoading(false)
        }
        return
      }
      if (!cancelled) {
        setSession(sess)
        setLoading(true)
        setProfileChecked(false)
      }
      const p = await fetchMyProfile()
      if (!cancelled) {
        setProfile(p)
        setProfileChecked(true)
        setLoading(false)
      }
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => load(s))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      load(s)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }

  if (loading || (session && !profileChecked)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <NetworkStatus />
      {!session ? (
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center bg-surface-950">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <Login />
        </Suspense>
      ) : !profile ? (
        <InactiveGate email={session.user?.email} onLogout={handleLogout} />
      ) : (
        <Layout session={session} profile={profile}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<MasterUnit />} />
              <Route path="/analisa" element={<AnalisaMasalah />} />
              <Route path="/penjualan" element={<Sales />} />
              <Route path="/keberangkatan" element={<Departures />} />
              <Route path="/commissioning" element={<Commissioning />} />
              <Route
                path="/akun"
                element={
                  profile.role === 'admin' ? <AccountManagement /> : <Navigate to="/" replace />
                }
              />
              <Route path="/units" element={<Navigate to="/" replace />} />
              <Route path="/documents" element={<Navigate to="/" replace />} />
              <Route path="/process" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      )}
    </ErrorBoundary>
  )
}

export default App
