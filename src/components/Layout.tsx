import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Truck,
  FileText,
  LogOut,
  ClipboardList,
  Menu,
  X,
  User,
  ShieldAlert,
  Wifi,
  WifiOff,
  Sparkles,
  Bot,
} from 'lucide-react'
import { Session } from '@supabase/supabase-js'
import { supabase, Unit } from '../lib/supabase'
import { cn } from '../lib/utils'
import AiUpdateModal from './AiUpdateModal'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/units', label: 'Unit', icon: Truck },
  { to: '/process', label: 'Process', icon: ClipboardList },
  { to: '/documents', label: 'Dokumen', icon: FileText },
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

  const [isAiModalOpen, setIsAiModalOpen] = useState(false)

  // Context units for AI natural language matching
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface-950 text-surface-100">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-surface-800 bg-surface-900/90 backdrop-blur sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold text-sm">
            SD
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-surface-50">SDLG Monitor</h1>
            <p className="text-[10px] text-surface-400">Population & Documents</p>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg text-surface-300 hover:text-surface-100 hover:bg-surface-800 transition-colors"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Backdrop & Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-surface-900 border-r border-surface-800 p-5 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-surface-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold text-sm">
                    SD
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-surface-50">SDLG Monitor</h2>
                    <p className="text-[10px] text-surface-400">Population & Documents</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-1.5">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-accent/15 text-accent border border-accent/20'
                          : 'text-surface-400 hover:bg-surface-800 hover:text-surface-100'
                      )
                    }
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="pt-2">
                <button
                  onClick={() => {
                    setIsAiModalOpen(true)
                    setMobileMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-accent/25 via-accent/15 to-transparent border border-accent/40 text-accent hover:bg-accent/30 transition-all shadow-sm"
                >
                  <Sparkles className="w-4 h-4 text-accent animate-pulse" />
                  <span>✨ AI Smart Updater</span>
                </button>
              </div>
            </div>

            {/* User & Logout */}
            <div className="pt-4 border-t border-surface-800 space-y-3">
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-950/60 border border-surface-800">
                <div className="w-7 h-7 rounded-full bg-surface-800 flex items-center justify-center text-surface-400">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-surface-200 truncate">{userEmail}</p>
                  <p className="text-[10px] text-accent">Active Operator</p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-400/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-surface-800 bg-surface-900 flex-col sticky top-0 h-screen">
        <div className="p-5 border-b border-surface-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold text-base shadow-sm">
            SD
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-surface-50">
              SDLG Monitor
            </h1>
            <p className="text-xs text-surface-400">Fleet & Document Ops</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-accent/10 text-accent font-semibold border-l-2 border-accent pl-2.5'
                    : 'text-surface-400 hover:bg-surface-800 hover:text-surface-100'
                )
              }
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* AI Smart Updater Special Nav Button */}
          <div className="pt-3">
            <button
              onClick={() => setIsAiModalOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-accent/20 via-accent/10 to-transparent border border-accent/35 text-accent hover:border-accent hover:bg-accent/25 transition-all shadow-sm group"
            >
              <Sparkles className="w-4 h-4 text-accent shrink-0 group-hover:rotate-12 transition-transform" />
              <div className="text-left">
                <span className="block leading-tight">AI Smart Updater</span>
                <span className="text-[10px] text-surface-400 font-normal">Update via Bahasa Alami</span>
              </div>
            </button>
          </div>
        </nav>

        {/* Realtime Connectivity Status Pill */}
        <div className="px-3 pt-2">
          <div
            className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px] font-medium border ${
              isOnline
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {isOnline && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isOnline ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
              </span>
              <span>{isOnline ? 'Realtime Sync Aktif' : 'Mode Offline Lapangan'}</span>
            </div>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          </div>
        </div>

        {/* User Profile & Logout Bottom Section */}
        <div className="p-3 border-t border-surface-800 space-y-2">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-950/60 border border-surface-800">
            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-semibold text-xs shrink-0">
              {userEmail.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-surface-200 truncate" title={userEmail}>
                {userEmail}
              </p>
              <span className="inline-block text-[10px] text-accent font-medium">
                ● Operator Cabang
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-surface-400 hover:bg-red-400/10 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar Sistem
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto relative">
        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">{children}</div>

        {/* Global Floating Quick Action Button for AI Updater */}
        <button
          onClick={() => setIsAiModalOpen(true)}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full bg-accent text-surface-950 font-bold text-xs shadow-xl shadow-accent/25 hover:shadow-accent/40 hover:scale-105 active:scale-95 transition-all"
          title="Buka AI Smart Updater"
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Update</span>
        </button>
      </main>

      {/* AI Update Modal mounted globally */}
      <AiUpdateModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        contextUnits={contextUnits}
      />
    </div>
  )
}
