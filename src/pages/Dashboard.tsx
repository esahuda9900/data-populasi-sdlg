import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, Unit, UnitProcess, UnitDocument } from '../lib/supabase'
import {
  Truck,
  FileWarning,
  FileCheck,
  AlertCircle,
  MapPin,
  Wrench,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  XCircle,
  BarChart3,
  Search,
  Download,
  Eye,
  Filter,
  ShieldAlert,
  Calendar,
  Layers,
  Sparkles,
  X,
  FileText,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts'
import { StatCardSkeleton, Skeleton, TableSkeleton } from '../components/Skeleton'
import { resolveUnitModel } from '../lib/modelUtils'
import { exportToCSV } from '../lib/exportUtils'
import { evaluateUnitCompliance, UnitComplianceStatus } from '../lib/complianceUtils'
import { useRealtimeSync } from '../lib/useRealtimeSync'
import { LiveStatusBadge } from '../components/LiveNotification'
import UnitDetailDrawer from '../components/UnitDetailDrawer'

const MODEL_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#f59e0b',
  '#06b6d4',
  '#8b5cf6',
  '#ec4899',
  '#10b981',
  '#6366f1',
  '#14b8a6',
  '#f97316',
]

const CABANG_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#a855f7',
  '#f97316',
  '#06b6d4',
  '#eab308',
  '#ec4899',
  '#64748b',
]

type AuditFilterCategory =
  | 'all'
  | 'missing_arrival'
  | 'missing_pdi'
  | 'missing_pdi_doc'
  | 'missing_ms'
  | 'missing_csa_2026'
  | 'missing_comm'
  | 'fully_ready'

export default function Dashboard() {
  const { isLiveConnected, lastSyncTime } = useRealtimeSync()
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null)
  const [auditFilter, setAuditFilter] = useState<AuditFilterCategory>('all')
  const [auditSearch, setAuditSearch] = useState('')
  const [auditPage, setAuditPage] = useState(0)
  const AUDIT_PAGE_SIZE = 25

  // Fetch full dataset for deep audit
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['dashboard_full_compliance_data'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const [unitsRes, processRes, docsRes] = await Promise.all([
        supabase.from('units').select('*').limit(10000),
        supabase.from('unit_process').select('*').limit(10000),
        supabase
          .from('unit_documents')
          .select('id, unit_id, status, document_types (id, code, name, is_required)')
          .limit(10000),
      ])

      const rawUnits: Unit[] = (unitsRes.data as Unit[]) || []
      const rawProcess: UnitProcess[] = (processRes.data as UnitProcess[]) || []
      const rawDocs: UnitDocument[] = (docsRes.data as unknown as UnitDocument[]) || []

      // Create lookup maps
      const procByVin = new Map<string, UnitProcess>()
      for (const p of rawProcess) {
        if (p.vin) procByVin.set(p.vin, p)
      }

      const docsByUnitId = new Map<string, UnitDocument[]>()
      for (const d of rawDocs) {
        if (!docsByUnitId.has(d.unit_id)) {
          docsByUnitId.set(d.unit_id, [])
        }
        docsByUnitId.get(d.unit_id)!.push(d)
      }

      // Evaluate compliance for all units
      const complianceList: UnitComplianceStatus[] = []
      const byModel: Record<string, number> = {}
      const byCabang: Record<string, number> = {}
      let activeUnits = 0

      for (const u of rawUnits) {
        const resolved = resolveUnitModel(u)
        const m = resolved.model || 'Perlu Dilengkapi'
        const c = u.under_cabang || 'Unknown'
        byModel[m] = (byModel[m] || 0) + 1
        byCabang[c] = (byCabang[c] || 0) + 1
        if (u.status === 'aktif') activeUnits++

        const p = u.vin ? procByVin.get(u.vin) : undefined
        const docs = docsByUnitId.get(u.id) || []
        const status = evaluateUnitCompliance(u, p, docs, resolved.model)
        complianceList.push(status)
      }

      setLastRefreshed(new Date())

      return {
        totalUnits: rawUnits.length,
        activeUnits,
        byModel,
        byCabang,
        complianceList,
      }
    },
  })

  // Calculate detailed aggregates
  const stats = useMemo(() => {
    if (!data) return null
    const list = data.complianceList

    let sudahArrival = 0, belumArrival = 0
    let sudahPdiCheck = 0, belumPdiCheck = 0
    let sudahPdiDoc = 0, belumPdiDoc = 0
    let sudahMS1 = 0, belumMS1 = 0
    let sudahMS2 = 0, belumMS2 = 0
    let sudahMS3 = 0, belumMS3 = 0
    let totalImport2026 = 0, sudahCSA2026 = 0, belumCSA2026 = 0
    let sudahComm = 0, belumComm = 0
    let fullyReadyCount = 0

    for (const item of list) {
      if (item.hasArrival) sudahArrival++; else belumArrival++
      if (item.hasPdiCheck) sudahPdiCheck++; else belumPdiCheck++
      if (item.hasPdiDocument) sudahPdiDoc++; else belumPdiDoc++
      if (item.hasMS1) sudahMS1++; else belumMS1++
      if (item.hasMS2) sudahMS2++; else belumMS2++
      if (item.hasMS3) sudahMS3++; else belumMS3++

      if (item.isImport2026) {
        totalImport2026++
        if (item.hasCSA) sudahCSA2026++; else belumCSA2026++
      }

      if (item.hasComm) sudahComm++; else belumComm++
      if (item.isFullyReady) fullyReadyCount++
    }

    return {
      totalUnits: data.totalUnits,
      activeUnits: data.activeUnits,
      byModel: data.byModel,
      byCabang: data.byCabang,
      sudahArrival, belumArrival,
      sudahPdiCheck, belumPdiCheck,
      sudahPdiDoc, belumPdiDoc,
      sudahMS1, belumMS1,
      sudahMS2, belumMS2,
      sudahMS3, belumMS3,
      totalImport2026, sudahCSA2026, belumCSA2026,
      sudahComm, belumComm,
      fullyReadyCount,
    }
  }, [data])

  // Filter audit items
  const filteredAuditList = useMemo(() => {
    if (!data) return []
    let list = data.complianceList

    switch (auditFilter) {
      case 'missing_arrival':
        list = list.filter((u) => !u.hasArrival)
        break
      case 'missing_pdi':
        list = list.filter((u) => !u.hasPdiCheck || !u.hasPdiDocument)
        break
      case 'missing_pdi_doc':
        list = list.filter((u) => !u.hasPdiDocument)
        break
      case 'missing_ms':
        list = list.filter((u) => !u.hasMS1 || !u.hasMS2 || !u.hasMS3)
        break
      case 'missing_csa_2026':
        list = list.filter((u) => u.isImport2026 && !u.hasCSA)
        break
      case 'missing_comm':
        list = list.filter((u) => !u.hasComm)
        break
      case 'fully_ready':
        list = list.filter((u) => u.isFullyReady)
        break
      default:
        break
    }

    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase().trim()
      list = list.filter(
        (u) =>
          u.unitNumber.toLowerCase().includes(q) ||
          u.vin.toLowerCase().includes(q) ||
          u.model.toLowerCase().includes(q) ||
          u.cabang.toLowerCase().includes(q) ||
          u.customer.toLowerCase().includes(q)
      )
    }

    return list
  }, [data, auditFilter, auditSearch])

  // Pagination for audit table
  const paginatedAuditList = useMemo(() => {
    const start = auditPage * AUDIT_PAGE_SIZE
    return filteredAuditList.slice(start, start + AUDIT_PAGE_SIZE)
  }, [filteredAuditList, auditPage])

  const totalAuditPages = Math.max(1, Math.ceil(filteredAuditList.length / AUDIT_PAGE_SIZE))

  const handleExportAudit = () => {
    const rows = filteredAuditList.map((u) => ({
      unit_number: u.unitNumber,
      vin: u.vin,
      model: u.model,
      cabang: u.cabang,
      customer: u.customer,
      tahun_delivery: u.yearDelivery || '—',
      arrival: u.hasArrival ? 'SUDAH' : 'BELUM',
      pdi_check: u.hasPdiCheck ? 'SUDAH' : 'BELUM',
      dokumen_pdi: u.hasPdiDocument ? 'SUDAH' : 'BELUM',
      ms_1: u.hasMS1 ? 'SUDAH' : 'BELUM',
      ms_2: u.hasMS2 ? 'SUDAH' : 'BELUM',
      ms_3: u.hasMS3 ? 'SUDAH' : 'BELUM',
      status_csa_2026: u.isImport2026 ? (u.hasCSA ? 'SUDAH CSA' : 'BELUM CSA (WAJIB)') : 'NON-2026',
      commissioning: u.hasComm ? 'SUDAH' : 'BELUM',
      status_lengkap: u.isFullyReady ? 'SIAP KERJA' : 'BELUM LENGKAP',
    }))

    exportToCSV(`audit-compliance-${auditFilter}`, rows, [
      { key: 'unit_number', label: 'No Unit' },
      { key: 'vin', label: 'VIN' },
      { key: 'model', label: 'Model' },
      { key: 'cabang', label: 'Cabang' },
      { key: 'customer', label: 'Customer' },
      { key: 'tahun_delivery', label: 'Tahun Delivery/BL' },
      { key: 'arrival', label: 'Arrival' },
      { key: 'pdi_check', label: 'PDI Check' },
      { key: 'dokumen_pdi', label: 'Dokumen PDI' },
      { key: 'ms_1', label: 'Maintenance Stock 1' },
      { key: 'ms_2', label: 'Maintenance Stock 2' },
      { key: 'ms_3', label: 'Maintenance Stock 3' },
      { key: 'status_csa_2026', label: 'Status CSA (Import 2026)' },
      { key: 'commissioning', label: 'Commissioning' },
      { key: 'status_lengkap', label: 'Kesiapan Unit' },
    ])
  }

  if (isLoading || !stats) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <TableSkeleton rows={8} cols={7} />
      </div>
    )
  }

  // Formatting chart data
  const modelChartData = Object.entries(stats.byModel)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }))

  const cabangChartData = Object.entries(stats.byCabang)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }))

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-surface-50">
            Audit Operasional & Populasi Armada SDLG
          </h2>
          <p className="text-sm text-surface-400 mt-1">
            Monitoring mendalam: Arrival, Maintenance Stock 1-3, Dokumen PDI, Kepatuhan CSA Impor 2026, dan Commissioning
          </p>
        </div>

        <div className="flex items-center gap-3">
          <LiveStatusBadge isLive={isLiveConnected} lastSync={lastSyncTime} />

          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-surface-500 block">Terakhir Sync:</span>
            <span className="text-xs text-surface-300 font-mono">
              {lastRefreshed.toLocaleTimeString('id-ID')} WIB
            </span>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
            title="Muat ulang data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin text-accent' : ''}`} />
            <span>{isRefetching ? 'Menyinkronkan...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Unit */}
        <div className="card p-5 border-blue-500/20 bg-blue-500/5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Total Unit Kita Punya</p>
              <p className="text-3xl font-extrabold text-surface-50">
                {stats.totalUnits.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-surface-400 mt-3 pt-3 border-t border-surface-800/60">
            {stats.activeUnits} unit berstatus aktif di cabang operasional
          </p>
        </div>

        {/* Card 2: 2026 Import CSA Mandatory */}
        <div
          onClick={() => { setAuditFilter('missing_csa_2026'); setAuditPage(0) }}
          className="card p-5 border-red-500/30 bg-red-500/5 cursor-pointer hover:border-red-500/60 transition-all group"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-400 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> Impor 2026 Wajib CSA
              </p>
              <p className="text-3xl font-extrabold text-red-400">
                {stats.belumCSA2026.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xs text-surface-400 mt-3 pt-3 border-t border-surface-800/60 flex items-center justify-between">
            <span>Dari {stats.totalImport2026} unit impor 2026</span>
            <span className="text-red-400 font-semibold group-hover:underline">Audit Unit →</span>
          </div>
        </div>

        {/* Card 3: PDI Belum Lengkap */}
        <div
          onClick={() => { setAuditFilter('missing_pdi'); setAuditPage(0) }}
          className="card p-5 border-amber-500/20 bg-amber-500/5 cursor-pointer hover:border-amber-500/50 transition-all group"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">PDI Belum Lengkap</p>
              <p className="text-3xl font-extrabold text-amber-400">
                {stats.belumPdiCheck.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xs text-surface-400 mt-3 pt-3 border-t border-surface-800/60 flex items-center justify-between">
            <span>{stats.belumPdiDoc} belum dokumen PDI</span>
            <span className="text-amber-400 font-semibold group-hover:underline">Audit Unit →</span>
          </div>
        </div>

        {/* Card 4: Siap Operasi Penuh */}
        <div
          onClick={() => { setAuditFilter('fully_ready'); setAuditPage(0) }}
          className="card p-5 border-emerald-500/20 bg-emerald-500/5 cursor-pointer hover:border-emerald-500/50 transition-all group"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Unit Siap Serah-Terima</p>
              <p className="text-3xl font-extrabold text-emerald-400">
                {stats.fullyReadyCount.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xs text-surface-400 mt-3 pt-3 border-t border-surface-800/60 flex items-center justify-between">
            <span>Lolos Arrival, PDI, CSA & COMM</span>
            <span className="text-emerald-400 font-semibold group-hover:underline">Lihat List →</span>
          </div>
        </div>
      </div>

      {/* Critical Compliance Warning Ribbon for 2026 CSA */}
      {stats.belumCSA2026 > 0 && (
        <div className="card p-4 sm:p-5 border-red-500/40 bg-red-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-300">
                Mandatory Agreement Rule: {stats.belumCSA2026} Unit Impor/BL 2026 Belum Memiliki Dokumen CSA!
              </h4>
              <p className="text-xs text-surface-300 mt-1 leading-relaxed">
                Setiap unit SDLG dengan Bill of Lading (BL) atau delivery import tahun <strong>2026</strong> wajib dilengkapi <strong>Customer Service Agreement (CSA)</strong> sebelum unit dioperasikan atau diserahterimakan. Silakan cek detail unit di bawah untuk melengkapi berkas.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setAuditFilter('missing_csa_2026'); setAuditPage(0) }}
            className="btn bg-red-500 text-white hover:bg-red-600 text-xs shrink-0 self-start sm:self-center flex items-center gap-1.5 font-semibold py-2 px-3.5 shadow-lg shadow-red-500/20"
          >
            Lihat Unit Belum CSA ({stats.belumCSA2026}) <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Matrix Detail Breakdown: SUDAH vs BELUM */}
      <div className="card p-6 space-y-6">
        <div>
          <h3 className="text-base font-bold text-surface-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" /> Rekapitulasi Lengkap: Status Sudah vs Belum per Tahapan
          </h3>
          <p className="text-xs text-surface-400 mt-0.5">
            Klik kartu kategori mana saja untuk langsung menyaring daftar unit fisik di tabel audit bawah.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* 1. Arrival */}
          <div
            onClick={() => { setAuditFilter('missing_arrival'); setAuditPage(0) }}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              auditFilter === 'missing_arrival'
                ? 'bg-accent/15 border-accent ring-1 ring-accent'
                : 'bg-surface-950/60 border-surface-800 hover:border-surface-700'
            }`}
          >
            <p className="text-xs font-semibold text-surface-400 mb-2">1. Arrival Check</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-medium">Sudah:</span>
                <span className="font-bold text-surface-100">{stats.sudahArrival}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-red-400 font-medium">Belum:</span>
                <span className="font-bold text-red-400">{stats.belumArrival}</span>
              </div>
            </div>
          </div>

          {/* 2. PDI Physical Check */}
          <div
            onClick={() => { setAuditFilter('missing_pdi'); setAuditPage(0) }}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              auditFilter === 'missing_pdi'
                ? 'bg-accent/15 border-accent ring-1 ring-accent'
                : 'bg-surface-950/60 border-surface-800 hover:border-surface-700'
            }`}
          >
            <p className="text-xs font-semibold text-surface-400 mb-2">2. PDI Check</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-medium">Sudah:</span>
                <span className="font-bold text-surface-100">{stats.sudahPdiCheck}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-red-400 font-medium">Belum:</span>
                <span className="font-bold text-red-400">{stats.belumPdiCheck}</span>
              </div>
            </div>
          </div>

          {/* 3. Dokumen PDI */}
          <div
            onClick={() => { setAuditFilter('missing_pdi_doc'); setAuditPage(0) }}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              auditFilter === 'missing_pdi_doc'
                ? 'bg-accent/15 border-accent ring-1 ring-accent'
                : 'bg-surface-950/60 border-surface-800 hover:border-surface-700'
            }`}
          >
            <p className="text-xs font-semibold text-surface-400 mb-2">3. Dokumen PDI</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-medium">Sudah:</span>
                <span className="font-bold text-surface-100">{stats.sudahPdiDoc}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-400 font-medium">Belum:</span>
                <span className="font-bold text-amber-400">{stats.belumPdiDoc}</span>
              </div>
            </div>
          </div>

          {/* 4. Maintenance Stock (MS 1, 2, 3) */}
          <div
            onClick={() => { setAuditFilter('missing_ms'); setAuditPage(0) }}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              auditFilter === 'missing_ms'
                ? 'bg-accent/15 border-accent ring-1 ring-accent'
                : 'bg-surface-950/60 border-surface-800 hover:border-surface-700'
            }`}
          >
            <p className="text-xs font-semibold text-surface-400 mb-2">4. Maint. Stock (MS 1-3)</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-surface-400">MS 1:</span>
                <span className="font-mono text-emerald-400">{stats.sudahMS1}</span>
                <span className="text-surface-500">/</span>
                <span className="font-mono text-red-400">{stats.belumMS1} blm</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-surface-400">MS 2:</span>
                <span className="font-mono text-emerald-400">{stats.sudahMS2}</span>
                <span className="text-surface-500">/</span>
                <span className="font-mono text-red-400">{stats.belumMS2} blm</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-surface-400">MS 3:</span>
                <span className="font-mono text-emerald-400">{stats.sudahMS3}</span>
                <span className="text-surface-500">/</span>
                <span className="font-mono text-red-400">{stats.belumMS3} blm</span>
              </div>
            </div>
          </div>

          {/* 5. Impor 2026 CSA */}
          <div
            onClick={() => { setAuditFilter('missing_csa_2026'); setAuditPage(0) }}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              auditFilter === 'missing_csa_2026'
                ? 'bg-red-500/20 border-red-500 ring-1 ring-red-500'
                : 'bg-surface-950/60 border-surface-800 hover:border-red-500/40'
            }`}
          >
            <p className="text-xs font-semibold text-red-400 mb-2">5. CSA Impor 2026</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-medium">Sudah CSA:</span>
                <span className="font-bold text-surface-100">{stats.sudahCSA2026}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-red-400 font-medium">Belum CSA:</span>
                <span className="font-bold text-red-400">{stats.belumCSA2026}</span>
              </div>
            </div>
          </div>

          {/* 6. Commissioning */}
          <div
            onClick={() => { setAuditFilter('missing_comm'); setAuditPage(0) }}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              auditFilter === 'missing_comm'
                ? 'bg-accent/15 border-accent ring-1 ring-accent'
                : 'bg-surface-950/60 border-surface-800 hover:border-surface-700'
            }`}
          >
            <p className="text-xs font-semibold text-surface-400 mb-2">6. Commissioning</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-medium">Sudah:</span>
                <span className="font-bold text-surface-100">{stats.sudahComm}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-red-400 font-medium">Belum:</span>
                <span className="font-bold text-red-400">{stats.belumComm}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Audit Drilldown Explorer */}
      <div className="card p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-surface-50">
                Audit Kepatuhan & Status Detail Unit
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface-800 text-surface-300 border border-surface-700">
                {filteredAuditList.length.toLocaleString('id-ID')} Unit Terpilih
              </span>
            </div>
            <p className="text-xs text-surface-400 mt-1">
              Pilih tab kategori untuk melihat unit mana saja yang sudah atau belum ada datanya, dan klik baris untuk membuka detail lengkap.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleExportAudit}
              disabled={filteredAuditList.length === 0}
              className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
              title="Download data audit ke CSV"
            >
              <Download className="w-3.5 h-3.5 text-accent" />
              <span>Export CSV Audit</span>
            </button>
          </div>
        </div>

        {/* Filter Category Pills */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-800 text-xs">
          {[
            { key: 'all', label: 'Semua Unit', count: stats.totalUnits },
            { key: 'missing_arrival', label: 'Belum Arrival', count: stats.belumArrival },
            { key: 'missing_pdi', label: 'Belum PDI Check', count: stats.belumPdiCheck },
            { key: 'missing_pdi_doc', label: 'Belum Dokumen PDI', count: stats.belumPdiDoc },
            { key: 'missing_ms', label: 'Belum MS 1-3', count: stats.belumMS1 + stats.belumMS2 + stats.belumMS3 },
            {
              key: 'missing_csa_2026',
              label: '⚠️ Impor 2026 Belum CSA',
              count: stats.belumCSA2026,
              highlight: true,
            },
            { key: 'missing_comm', label: 'Belum COMM', count: stats.belumComm },
            { key: 'fully_ready', label: '✓ Siap Operasi Penuh', count: stats.fullyReadyCount },
          ].map((tab) => {
            const isSelected = auditFilter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setAuditFilter(tab.key as any)
                  setAuditPage(0)
                }}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? tab.highlight
                      ? 'bg-red-500 text-white font-bold shadow-md shadow-red-500/20'
                      : 'bg-accent text-white font-bold shadow-md shadow-accent/20'
                    : tab.highlight
                    ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                    : 'bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-surface-100'
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] font-mono opacity-80 px-1.5 py-0.2 rounded-full bg-black/20">
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search within Audit Explorer */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              type="text"
              placeholder="Cari No Unit, VIN, Model, Cabang, atau Customer..."
              value={auditSearch}
              onChange={(e) => {
                setAuditSearch(e.target.value)
                setAuditPage(0)
              }}
              className="input pl-9 text-xs"
            />
            {auditSearch && (
              <button
                onClick={() => {
                  setAuditSearch('')
                  setAuditPage(0)
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-xs text-surface-500 hidden sm:block">
            Klik baris untuk membuka panel detail & inspeksi unit
          </p>
        </div>

        {/* Audit Table */}
        {filteredAuditList.length === 0 ? (
          <div className="card text-center py-12 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-accent mx-auto" />
            <p className="text-sm font-semibold text-surface-200">
              Tidak ada unit pada kriteria ini
            </p>
            <p className="text-xs text-surface-400">
              Semua unit telah melengkapi tahapan ini atau kata kunci pencarian tidak ditemukan.
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden p-0 shadow-lg border border-surface-800">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-surface-800 bg-surface-950/80 text-left text-surface-400">
                    <th className="px-4 py-3 font-semibold sticky left-0 bg-surface-950 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                      No Unit & VIN
                    </th>
                    <th className="px-3 py-3 font-semibold">Model</th>
                    <th className="px-3 py-3 font-semibold">Cabang</th>
                    <th className="px-3 py-3 font-semibold">Tahun/BL</th>
                    <th className="px-3 py-3 font-semibold text-center">1. Arrival</th>
                    <th className="px-3 py-3 font-semibold text-center">2. PDI (Fisik/Dok)</th>
                    <th className="px-3 py-3 font-semibold text-center">3. MS 1-3</th>
                    <th className="px-3 py-3 font-semibold text-center">4. CSA 2026</th>
                    <th className="px-3 py-3 font-semibold text-center">5. COMM</th>
                    <th className="px-3 py-3 font-semibold text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/40">
                  {paginatedAuditList.map((u) => (
                    <tr
                      key={u.unitId}
                      onClick={() => setSelectedUnit(u.rawUnit)}
                      className="hover:bg-surface-800/40 cursor-pointer transition-colors group"
                    >
                      {/* Identity */}
                      <td className="px-4 py-3 sticky left-0 bg-surface-900 group-hover:bg-surface-850 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                        <div className="font-bold text-surface-100 group-hover:text-accent transition-colors">
                          {u.unitNumber}
                        </div>
                        <div className="text-[10px] text-surface-400 font-mono mt-0.5">{u.vin}</div>
                      </td>

                      {/* Model */}
                      <td className="px-3 py-3 font-semibold text-surface-200">
                        {u.model}
                      </td>

                      {/* Cabang */}
                      <td className="px-3 py-3 text-surface-300">
                        <div>{u.cabang}</div>
                        <div className="text-[10px] text-surface-500 truncate max-w-[120px]" title={u.customer}>
                          {u.customer}
                        </div>
                      </td>

                      {/* Delivery Year / BL */}
                      <td className="px-3 py-3">
                        {u.isImport2026 ? (
                          <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-red-400/15 text-red-400 border border-red-500/30">
                            2026 (Wajib CSA)
                          </span>
                        ) : (
                          <span className="text-surface-400 font-mono">
                            {u.yearDelivery || '—'}
                          </span>
                        )}
                      </td>

                      {/* 1. Arrival */}
                      <td className="px-3 py-3 text-center">
                        {u.hasArrival ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" /> Sudah
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-400/15 text-red-400">
                            <XCircle className="w-3 h-3" /> Belum
                          </span>
                        )}
                      </td>

                      {/* 2. PDI */}
                      <td className="px-3 py-3 text-center">
                        <div className="space-y-0.5">
                          <div>
                            {u.hasPdiCheck ? (
                              <span className="text-[10px] text-emerald-400 font-medium">✓ Cek OK</span>
                            ) : (
                              <span className="text-[10px] text-red-400 font-medium">✗ Cek Blm</span>
                            )}
                          </div>
                          <div>
                            {u.hasPdiDocument ? (
                              <span className="text-[10px] text-accent font-medium">✓ Dok OK</span>
                            ) : (
                              <span className="text-[10px] text-amber-400 font-medium">✗ Dok Blm</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. MS 1-3 */}
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1 font-mono text-[10px]">
                          <span
                            className={`px-1 py-0.2 rounded ${
                              u.hasMS1 ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'bg-surface-800 text-surface-500'
                            }`}
                            title="Maintenance Stock 1"
                          >
                            1
                          </span>
                          <span
                            className={`px-1 py-0.2 rounded ${
                              u.hasMS2 ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'bg-surface-800 text-surface-500'
                            }`}
                            title="Maintenance Stock 2"
                          >
                            2
                          </span>
                          <span
                            className={`px-1 py-0.2 rounded ${
                              u.hasMS3 ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'bg-surface-800 text-surface-500'
                            }`}
                            title="Maintenance Stock 3"
                          >
                            3
                          </span>
                        </div>
                      </td>

                      {/* 4. CSA 2026 */}
                      <td className="px-3 py-3 text-center">
                        {!u.isImport2026 ? (
                          <span className="text-surface-500 text-[10px]">Non-2026</span>
                        ) : u.hasCSA ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Ada CSA
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                            <ShieldAlert className="w-3 h-3" /> Wajib CSA
                          </span>
                        )}
                      </td>

                      {/* 5. COMM */}
                      <td className="px-3 py-3 text-center">
                        {u.hasComm ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" /> Sudah
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-400/15 text-red-400">
                            <XCircle className="w-3 h-3" /> Belum
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedUnit(u.rawUnit)
                          }}
                          className="p-1 rounded text-surface-400 hover:text-accent hover:bg-surface-800 transition-colors"
                          title="Buka Detail Unit 360°"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Audit Table Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs">
          <p className="text-surface-400">
            Menampilkan baris {filteredAuditList.length > 0 ? auditPage * AUDIT_PAGE_SIZE + 1 : 0} -{' '}
            {Math.min((auditPage + 1) * AUDIT_PAGE_SIZE, filteredAuditList.length)} dari{' '}
            {filteredAuditList.length.toLocaleString('id-ID')} unit audit
          </p>

          <div className="flex items-center gap-2">
            <button
              disabled={auditPage === 0}
              onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
              className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <span className="text-xs text-surface-300 px-2 font-mono">
              {auditPage + 1} / {totalAuditPages}
            </span>
            <button
              disabled={auditPage >= totalAuditPages - 1}
              onClick={() => setAuditPage((p) => p + 1)}
              className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts Section (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Top 8 Models */}
        <div className="card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-surface-200">Top Model Terbanyak</h3>
            </div>
            <span className="text-xs text-surface-400">Top 8 Model</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={modelChartData}
                layout="vertical"
                margin={{ top: 5, right: 15, left: 15, bottom: 5 }}
              >
                <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#f8fafc',
                  }}
                  formatter={(value: any) => [`${Number(value).toLocaleString('id-ID')} Unit`, 'Populasi']}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {modelChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={MODEL_COLORS[index % MODEL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Per Cabang */}
        <div className="card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-surface-200">Populasi Per Cabang</h3>
            </div>
            <span className="text-xs text-surface-400">Regional</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={cabangChartData}
                margin={{ top: 10, right: 10, left: -15, bottom: 25 }}
              >
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  angle={-25}
                  textAnchor="end"
                />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#f8fafc',
                  }}
                  formatter={(value: any) => [`${Number(value).toLocaleString('id-ID')} Unit`, 'Cabang']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {cabangChartData.map((_, index) => (
                    <Cell key={`cabang-${index}`} fill={CABANG_COLORS[index % CABANG_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Unit Detail Slide-Over Drawer */}
      {selectedUnit && (
        <UnitDetailDrawer
          unit={selectedUnit}
          onClose={() => setSelectedUnit(null)}
        />
      )}
    </div>
  )
}
