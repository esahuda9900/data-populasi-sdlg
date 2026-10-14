import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NetworkStatus } from './components/NetworkStatus'
import { Skeleton } from './components/Skeleton'

const Login = lazy(() => import('./pages/Login'))
const MasterUnit = lazy(() => import('./pages/MasterUnit'))
const Sales = lazy(() => import('./pages/Sales'))
const Departures = lazy(() => import('./pages/Departures'))
const Commissioning = lazy(() => import('./pages/Commissioning'))

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

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
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
      ) : (
        <Layout session={session}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<MasterUnit />} />
              <Route path="/penjualan" element={<Sales />} />
              <Route path="/keberangkatan" element={<Departures />} />
              <Route path="/commissioning" element={<Commissioning />} />
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
