import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff,
  Sparkles,
  ShoppingCart,
  Ship,
  Wrench,
  PackageSearch,
  AlertTriangle,
} from 'lucide-react'
import { Session } from '@supabase/supabase-js'
import { supabase, Unit } from '../lib/supabase'
import { cn } from '../lib/utils'
import AiUpdateModal from './AiUpdateModal'

const navSections = [
  {
    title: 'Master',
    items: [{ to: '/', label: 'Master Unit', icon: PackageSearch }],
  },
  {
    title: 'Analisa',
    items: [{ to: '/analisa', label: 'Analisa Masalah', icon: AlertTriangle }],
  },
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
}: {
  children: React.ReactNode
  session?: Session | null
}) {
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const { data: contextUnits = [] } = useQuery<Unit[]>({
    queryKey: ['layout_ai_context_units'],
    queryFn: async () => {
      const { data } = await supabase.from('units').select('*').limit(300)
      return (data as Unit[]) || []
    },
    staleTime: 60 * 1000,
  })

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const userEmail = session?.user?.email || 'operator@sdlg.id'

  const NavBlocks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {navSections.map((section) => (
        <div key={section.title} className="mb-3">
          <p className="px-3 mb-1 text-[10px] uppercase tracking-wider text-surface-500 font-semibold">
            {section.title}
          </p>
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
                <span>{item.label}</span>
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
          <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold text-sm">
            SD
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-surface-50">SDLG Monitor</h1>
            <p className="text-[10px] text-surface-400">Master & Data Sumber</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg text-surface-300 hover:text-surface-100 hover:bg-surface-800"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 bg-surface-900 border-r border-surface-800 p-5 flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 mb-3 border-b border-surface-800">
                <h2 className="text-sm font-semibold text-surface-50">SDLG Monitor</h2>
                <button type="button" onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg text-surface-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav>
                <NavBlocks onNavigate={() => setMobileMenuOpen(false)} />
              </nav>
              <button
                type="button"
                onClick={() => {
                  setIsAiModalOpen(true)
                  setMobileMenuOpen(false)
                }}
                className="w-full mt-2 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border border-accent/40 text-accent bg-accent/10"
              >
                <Sparkles className="w-4 h-4" /> AI Smart Updater
              </button>
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
          <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold text-base">
            SD
          </div>
          <div>
            <h1 className="text-base font-semibold text-surface-50">SDLG Monitor</h1>
            <p className="text-xs text-surface-400">Master & Data Sumber</p>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          <NavBlocks />
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold border border-accent/35 text-accent bg-accent/10 hover:bg-accent/20"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <div className="text-left">
                <span className="block">AI Smart Updater</span>
                <span className="text-[10px] text-surface-400 font-normal">Bahasa alami</span>
              </div>
            </button>
          </div>
        </nav>

        <div className="px-3 pt-2">
          <div
            className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px] font-medium border ${
              isOnline
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            <span>{isOnline ? 'Realtime Sync Aktif' : 'Offline'}</span>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          </div>
        </div>

        <div className="p-3 border-t border-surface-800 space-y-2">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-950/60 border border-surface-800">
            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-semibold text-xs">
              {userEmail.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-surface-200 truncate">{userEmail}</p>
              <span className="text-[10px] text-accent">Operator</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-surface-400 hover:bg-red-400/10 hover:text-red-400"
          >
            <LogOut className="w-3.5 h-3.5" /> Keluar Sistem
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden overflow-y-auto relative">
        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
        <button
          type="button"
          onClick={() => setIsAiModalOpen(true)}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full bg-accent text-surface-950 font-bold text-xs shadow-xl"
        >
          <Sparkles className="w-4 h-4" /> AI Update
        </button>
      </main>

      <AiUpdateModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} contextUnits={contextUnits} />
    </div>
  )
}
