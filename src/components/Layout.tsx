import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LogOut, Menu, X, Wifi, WifiOff, Sparkles, ShoppingCart, Ship, Wrench,
  PackageSearch, AlertTriangle, Shield,
} from 'lucide-react'
import { Session } from '@supabase/supabase-js'
import { supabase, Unit } from '../lib/supabase'
import { cn } from '../lib/utils'
import AiUpdateModal from './AiUpdateModal'
import { UserProfile, canUseAi, isAdmin } from '../lib/authProfile'

const navSectionsBase = [
  { title: 'Master', items: [{ to: '/', label: 'Master Unit', icon: PackageSearch }] },
  { title: 'Analisa', items: [{ to: '/analisa', label: 'Analisa Masalah', icon: AlertTriangle }] },
  {
    title: 'Data sumber',
    items: [
      { to: '/penjualan', label: 'Penjualan', icon: ShoppingCart },
      { to: '/keberangkatan', label: 'Keberangkatan (SJU)', icon: Ship },
      { to: '/commissioning', label: 'Commissioning (WO)', icon: Wrench },
    ],
  },
]

export default function Layout({
  children,
  session,
  profile,
}: {
  children: React.ReactNode
  session?: Session | null
  profile: UserProfile
}) {
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const showAi = canUseAi(profile.role)
  const admin = isAdmin(profile.role)

  const { data: pendingCount = 0, refetch: refetchPending } = useQuery({
    queryKey: ['nav_pending_requests'],
    enabled: admin,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('account_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      if (error) return 0
      return count || 0
    },
  })

  useEffect(() => {
    if (!admin) return
    const channel = supabase
      .channel('nav-pending-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'account_requests' },
        () => { refetchPending() }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [admin, refetchPending])

  const navSections = admin
    ? [...navSectionsBase, { title: 'Admin', items: [{ to: '/akun', label: 'Account Management', icon: Shield }] }]
    : navSectionsBase

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const { data: contextUnits = [] } = useQuery<Unit[]>({
    queryKey: ['layout_ai_context_units'],
    queryFn: async () => {
      const { data } = await supabase.from('units').select('*').limit(300)
      return (data as Unit[]) || []
    },
    staleTime: 60 * 1000,
    enabled: showAi,
  })

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const userEmail = session?.user?.email || profile.full_name || 'user'
  const roleLabel = profile.role === 'admin' ? 'Admin' : profile.role === 'operator' ? 'Operator' : 'Viewer'

  const NavBlocks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {navSections.map((section) => (
        <div key={section.title} className="mb-3">
          <p className="px-3 mb-1 text-[10px] uppercase tracking-wider text-surface-500 font-semibold">{section.title}</p>
          <div className="space-y-1">
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-accent/10 text-accent font-semibold border-l-2 border-accent pl-2.5'
                      : 'text-surface-400 hover:bg-surface-800 hover:text-surface-100'
                  )
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.to === '/akun' && pendingCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </>
  )

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface-950 text-surface-100">
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-surface-800 bg-surface-900/90 backdrop-blur sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold text-sm">SD</div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-surface-50">SDLG Monitor</h1>
            <p className="text-[10px] text-surface-400">{roleLabel}</p>
          </div>
        </div>
        <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-lg text-surface-300" aria-label="Toggle menu">
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black/70" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 bg-surface-900 border-r border-surface-800 p-5 flex flex-col justify-between overflow-y-auto">
            <div>
              <nav><NavBlocks onNavigate={() => setMobileMenuOpen(false)} /></nav>
              {showAi && (
                <button type="button" onClick={() => { setIsAiModalOpen(true); setMobileMenuOpen(false) }} className="w-full mt-2 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border border-accent/40 text-accent bg-accent/10">
                  <Sparkles className="w-4 h-4" /> AI Smart Updater
                </button>
              )}
            </div>
            <div className="pt-4 border-t border-surface-800 space-y-2">
              <p className="text-xs text-surface-300 truncate px-2">{userEmail}</p>
              <button type="button" onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400">
                <LogOut className="w-4 h-4" /> Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="hidden md:flex w-64 shrink-0 border-r border-surface-800 bg-surface-900 flex-col sticky top-0 h-screen">
        <div className="p-5 border-b border-surface-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold text-base">SD</div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-surface-50">SDLG Monitor</h1>
            <p className="text-[11px] text-surface-400">{roleLabel}</p>
          </div>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          <NavBlocks />
          {showAi && (
            <button type="button" onClick={() => setIsAiModalOpen(true)} className="w-full mt-2 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border border-accent/40 text-accent bg-accent/10">
              <Sparkles className="w-4 h-4" /> AI Smart Updater
            </button>
          )}
        </nav>
        <div className="p-4 border-t border-surface-800 space-y-2">
          <div className="flex items-center gap-2 px-2 text-xs text-surface-400">
            {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <p className="text-xs text-surface-300 truncate px-2">{userEmail}</p>
          <button type="button" onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg">
            <LogOut className="w-4 h-4" /> Keluar
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-6 overflow-x-hidden">{children}</main>

      {showAi && (
        <AiUpdateModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} units={contextUnits} />
      )}
    </div>
  )
}
