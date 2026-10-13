import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, Unit } from '../lib/supabase'
import {
  Truck,
  FileWarning,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  Search,
  Download,
  Eye,
  ShieldAlert,
  Sparkles,
  X,
  XCircle,
  Calendar,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts'
import { StatCardSkeleton, Skeleton, TableSkeleton } from '../components/Skeleton'
import { batchSyncMissingModels } from '../lib/modelUtils'
import { exportToCSV } from '../lib/exportUtils'
import { PROCESS_BLOCKER_LABELS } from '../lib/complianceUtils'
import { useRealtimeSync } from '../lib/useRealtimeSync'
import { LiveStatusBadge } from '../components/LiveNotification'
import UnitDetailDrawer from '../components/UnitDetailDrawer'
import AiUpdateModal from '../components/AiUpdateModal'

const MODEL_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#06b6d4', '#8b5cf6',
  '#ec4899', '#10b981', '#6366f1', '#14b8a6', '#f97316',
]
const CABANG_COLORS = [
  '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#06b6d4',
  '#eab308', '#ec4899', '#64748b',
]

type AuditFilter =
  | 'all'
  | 'missing_arrival'
  | 'missing_pdi'
  | 'ms_overdue'
  | 'missing_csa_2026'
  | 'missing_comm'
  | 'critical_gap'
  | 'complete'
  | 'missing_model'

const PAGE_SIZE = 25

function GateBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
      <CheckCircle2 className="w-3 h-3" /> DONE
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400">
      <XCircle className="w-3 h-3" /> Belum
    </span>
  )
}

export default function Dashboard() {
  const { isLiveConnected, lastSyncTime } = useRealtimeSync()
  const [lastRefreshed, setLastRefreshed] = useState(new Date())
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null)
  const [auditFilter, setAuditFilter] = useState<AuditFilter>('all')
  const [auditSearch, setAuditSearch] = useState('')
  const [auditPage, setAuditPage] = useState(0)
  const [isAutoFixing, setIsAutoFixing] = useState(false)
  const [autoFixProgress, setAutoFixProgress] = useState<{ current: number; total: number } | null>(null)
  const [autoFixResult, setAutoFixResult] = useState<{
    totalScanned: number
    updatedCount: number
    unresolvableCount: number
  } | null>(null)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)

  const {
    data: summary,
    isLoading: summaryLoading,
    isRefetching,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['dashboard_v_compliance_summary'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_compliance_summary').select('*').single()
      if (error) throw error
      setLastRefreshed(new Date())
      return data as Record<string, number>
    },
  })

  const { data: processCounts } = useQuery({
    queryKey: ['dashboard_process_done_counts'],
    staleTime: 30_000,
    queryFn: async () => {
      let ms1 = 0, ms2 = 0, ms3 = 0, pdi = 0, comm = 0, arr = 0
      const pageSize = 1000
      let from = 0
      for (;;) {
        const { data, error } = await supabase
          .from('unit_process')
          .select('arrival_check, arrival_date, ms_check_1, ms_check_2, ms_check_3, pdi_check, comm_check')
          .range(from, from + pageSize - 1)
        if (error) throw error
        const rows = data || []
        for (const r of rows) {
          if (r.arrival_check === 'DONE' || r.arrival_date) arr++
          if (r.ms_check_1 === 'DONE') ms1++
          if (r.ms_check_2 === 'DONE') ms2++
          if (r.ms_check_3 === 'DONE') ms3++
          if (r.pdi_check === 'DONE') pdi++
          if (r.comm_check === 'DONE') comm++
        }
        if (rows.length < pageSize) break
        from += pageSize
        if (from > 20000) break
      }
      return { ms1, ms2, ms3, pdi, comm, arr }
    },
  })

  const { data: chartData } = useQuery({
    queryKey: ['dashboard_charts_agg'],
    staleTime: 60_000,
    queryFn: async () => {
      const byModel: Record<string, number> = {}
      const byCabang: Record<string, number> = {}
      let missingModel = 0
      const pageSize = 1000
      let from = 0
      for (;;) {
        const { data, error } = await supabase
          .from('units')
          .select('model, under_cabang')
          .range(from, from + pageSize - 1)
        if (error) throw error
        const rows = data || []
        for (const u of rows) {
          const m = (u.model || '').trim()
          if (!m || m === 'KOSONG' || m === 'Unknown' || m === '\u2014') {
            missingModel++
            byModel['(kosong)'] = (byModel['(kosong)'] || 0) + 1
          } else {
            byModel[m] = (byModel[m] || 0) + 1
          }
          const c = u.under_cabang || 'Unknown'
          byCabang[c] = (byCabang[c] || 0) + 1
        }
        if (rows.length < pageSize) break
        from += pageSize
        if (from > 20000) break
      }
      return { byModel, byCabang, missingModel }
    },
  })

  const { data: auditPageData, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ['dashboard_audit_page', auditFilter, auditSearch, auditPage],
    staleTime: 15_000,
    queryFn: async () => {
      let q = supabase
        .from('v_unit_compliance')
        .select('*', { count: 'exact' })
        .order('unit_number')

      if (auditFilter === 'missing_arrival') q = q.eq('gate_arrival', false)
      else if (auditFilter === 'missing_pdi') q = q.eq('gate_pdi', false)
      else if (auditFilter === 'ms_overdue')
        q = q.or('ms1_overdue.eq.true,ms2_overdue.eq.true,ms3_overdue.eq.true')
      else if (auditFilter === 'missing_csa_2026')
        q = q.eq('csa_required', true).neq('csa_status', 'uploaded')
      else if (auditFilter === 'missing_comm') q = q.eq('gate_comm', false)
      else if (auditFilter === 'critical_gap') q = q.eq('is_critical_gap', true)
      else if (auditFilter === 'complete') q = q.eq('is_process_complete', true)
      else if (auditFilter === 'missing_model')
        q = q.or('model.is.null,model.eq.,model.eq.KOSONG,model.eq.Unknown')

      if (auditSearch.trim()) {
        const s = auditSearch.trim()
        q = q.or(
          `vin.ilike.%${s}%,unit_number.ilike.%${s}%,model.ilike.%${s}%,customer.ilike.%${s}%,under_cabang.ilike.%${s}%`
        )
      }

      const from = auditPage * PAGE_SIZE
      const { data, error, count } = await q.range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      return { rows: data || [], total: count ?? 0 }
    },
  })

  const totalUnits = summary?.total_units ?? 0
  const arrivalDone = summary?.arrival_done ?? processCounts?.arr ?? 0
  const arrivalMissing = summary?.arrival_missing ?? Math.max(0, totalUnits - arrivalDone)
  const pdiDone = summary?.pdi_done ?? processCounts?.pdi ?? 0
  const pdiMissing = summary?.pdi_missing ?? Math.max(0, totalUnits - pdiDone)
  const csaRequired = summary?.csa_required_count ?? 0
  const csaMissing = summary?.csa_missing_count ?? 0
  const processComplete = summary?.process_complete_count ?? 0
  const criticalGaps = summary?.critical_gap_count ?? 0
  const ms1Overdue = summary?.ms1_overdue_count ?? 0
  const commDone = summary?.comm_done ?? processCounts?.comm ?? 0

  const ms1Done = processCounts?.ms1 ?? 0
  const ms2Done = processCounts?.ms2 ?? 0
  const ms3Done = processCounts?.ms3 ?? 0

  const modelChartData = useMemo(() => {
    if (!chartData) return []
    return Object.entries(chartData.byModel)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }))
  }, [chartData])

  const cabangChartData = useMemo(() => {
    if (!chartData) return []
    return Object.entries(chartData.byCabang)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }))
  }, [chartData])

  const auditRows = auditPageData?.rows || []
  const auditTotal = auditPageData?.total ?? 0
  const auditPages = Math.max(1, Math.ceil(auditTotal / PAGE_SIZE))

  const refetchAll = () => {
    refetchSummary()
    refetchAudit()
  }

  const handleAutoFix = async () => {
    setIsAutoFixing(true)
    setAutoFixProgress({ current: 0, total: 0 })
    setAutoFixResult(null)
    try {
      const res = await batchSyncMissingModels(supabase, (cur, tot) => {
        setAutoFixProgress({ current: cur, total: tot })
      })
      setAutoFixResult(res)
      refetchAll()
    } catch (e) {
      console.error(e)
    } finally {
      setIsAutoFixing(false)
    }
  }

  const handleExport = () => {
    exportToCSV(
      'audit-dashboard-sdlg',
      auditRows.map((r: any) => ({
        unit_number: r.unit_number,
        vin: r.vin,
        model: r.model,
        cabang: r.under_cabang,
        year: r.year_delivery,
        bl_date: r.bl_date,
        arrival: r.gate_arrival ? 'DONE' : 'BELUM',
        pdi: r.gate_pdi ? 'DONE' : 'BELUM',
        ms1: r.ms_check_1,
        csa: r.csa_required ? r.csa_status || 'missing' : 'n/a',
        comm: r.gate_comm ? 'DONE' : 'BELUM',
        blocker: r.process_blocker,
        critical: r.is_critical_gap ? 'YES' : 'NO',
      })),
      [
        { key: 'unit_number', label: 'No Unit' },
        { key: 'vin', label: 'VIN' },
        { key: 'model', label: 'Model' },
        { key: 'cabang', label: 'Cabang' },
        { key: 'year', label: 'Year BL' },
        { key: 'bl_date', label: 'BL Date' },
        { key: 'arrival', label: 'Arrival' },
        { key: 'pdi', label: 'PDI' },
        { key: 'ms1', label: 'MS1' },
        { key: 'csa', label: 'CSA' },
        { key: 'comm', label: 'COMM' },
        { key: 'blocker', label: 'Blocker' },
        { key: 'critical', label: 'Critical' },
      ]
    )
  }

  const openUnit = (r: any) => {
    setSelectedUnit({
      id: r.unit_id,
      vin: r.vin,
      unit_number: r.unit_number,
      model: r.model,
      serial_number: r.serial_number,
      year_delivery: r.year_delivery,
      under_cabang: r.under_cabang,
      customer: r.customer,
      location: r.location,
      status: r.unit_status,
      stock_status: r.stock_status,
      bill_of_lading: r.bill_of_lading,
      created_at: '',
      updated_at: '',
      group_type: null,
      variant: null,
      customer_update: null,
      marketing_status: null,
      device_number: null,
    } as Unit)
  }

  if (summaryLoading && !summary) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-96" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  const filterTabs: { key: AuditFilter; label: string; count: number | string; danger?: boolean }[] = [
    { key: 'all', label: 'Semua Unit', count: totalUnits },
    { key: 'critical_gap', label: 'Critical Gap', count: criticalGaps, danger: true },
    { key: 'missing_arrival', label: 'Belum Arrival', count: arrivalMissing },
    { key: 'missing_pdi', label: 'Belum PDI', count: pdiMissing },
    { key: 'ms_overdue', label: 'MS Overdue', count: ms1Overdue },
    { key: 'missing_csa_2026', label: 'CSA 2026', count: csaMissing, danger: true },
    { key: 'missing_comm', label: 'Belum COMM', count: Math.max(0, totalUnits - commDone) },
    { key: 'complete', label: 'Proses Lengkap', count: processComplete },
    { key: 'missing_model', label: 'Model Kosong', count: chartData?.missingModel ?? '\u2014' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-surface-50">
            Audit Operasional & Populasi Armada SDLG
          </h2>
          <p className="text-sm text-surface-400 mt-1">
            Engine compliance \u00b7 full fleet {totalUnits.toLocaleString('id-ID')} unit \u00b7 Arrival, MS, CSA 2026, PDI, COMM
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LiveStatusBadge isLive={isLiveConnected} lastSync={lastSyncTime} />
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 font-semibold text-accent border-accent/40 bg-accent/10"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Update Data
          </button>
          <button
            onClick={handleAutoFix}
            disabled={isAutoFixing}
            className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 text-amber-400"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAutoFixing ? 'animate-spin' : ''}`} />
            {isAutoFixing ? 'Memperbaiki...' : 'Auto-Fix Model'}
          </button>
          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-surface-500 block">Terakhir Sync:</span>
            <span className="text-xs text-surface-300 font-mono">
              {lastRefreshed.toLocaleTimeString('id-ID')} WIB
            </span>
          </div>
          <button
            onClick={refetchAll}
            disabled={isRefetching}
            className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin text-accent' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {isAutoFixing && autoFixProgress && (
        <div className="card p-4 border-amber-500/30 bg-amber-500/10 text-xs">
          Memproses model {autoFixProgress.current}/{autoFixProgress.total}\u2026
        </div>
      )}
      {autoFixResult && (
        <div className="card p-4 border-emerald-500/30 bg-emerald-500/10 flex justify-between text-xs">
          <span>
            Auto-fix: {autoFixResult.updatedCount}/{autoFixResult.totalScanned} diupdate (
            {autoFixResult.unresolvableCount} perlu manual)
          </span>
          <button onClick={() => setAutoFixResult(null)} className="text-surface-400">
            Tutup
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 border-blue-500/20 bg-blue-500/5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Total Unit</p>
              <p className="text-3xl font-extrabold text-surface-50">{totalUnits.toLocaleString('id-ID')}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-surface-400 mt-3 pt-3 border-t border-surface-800/60">Full populasi (server view)</p>
        </div>

        <div
          className="card p-5 border-red-500/30 bg-red-500/5 cursor-pointer hover:border-red-500/60"
          onClick={() => { setAuditFilter('missing_csa_2026'); setAuditPage(0) }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-red-400 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> Impor 2026 CSA
              </p>
              <p className="text-3xl font-extrabold text-red-400">{csaMissing.toLocaleString('id-ID')}</p>
            </div>
            <div className="p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-surface-400 mt-3 pt-3 border-t border-surface-800/60">
            Dari {csaRequired} unit BL 2026 \u00b7 Audit \u2192
          </p>
        </div>

        <div
          className="card p-5 border-amber-500/20 bg-amber-500/5 cursor-pointer"
          onClick={() => { setAuditFilter('missing_pdi'); setAuditPage(0) }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">PDI Belum</p>
              <p className="text-3xl font-extrabold text-amber-400">{pdiMissing.toLocaleString('id-ID')}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FileWarning className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-surface-400 mt-3 pt-3 border-t border-surface-800/60">
            Sudah PDI: {pdiDone.toLocaleString('id-ID')}
          </p>
        </div>

        <div
          className="card p-5 border-emerald-500/20 bg-emerald-500/5 cursor-pointer"
          onClick={() => { setAuditFilter('complete'); setAuditPage(0) }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Proses Lengkap</p>
              <p className="text-3xl font-extrabold text-emerald-400">{processComplete.toLocaleString('id-ID')}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-surface-400 mt-3 pt-3 border-t border-surface-800/60">
            Critical gap: {criticalGaps.toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {csaMissing > 0 && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-300 text-sm">
                Mandatory: {csaMissing} unit BL 2026 belum dokumen CSA
              </p>
              <p className="text-xs text-surface-400 mt-1">
                CSA wajib sebelum PDI & serah terima untuk unit dengan tahun bill of lading 2026.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setAuditFilter('missing_csa_2026'); setAuditPage(0) }}
            className="btn-secondary text-xs px-3 py-2 text-red-300 border-red-500/40"
          >
            Lihat unit <ArrowRight className="w-3.5 h-3.5 inline" />
          </button>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-surface-300 mb-3">Rekapitulasi per tahapan</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {([
            { key: 'missing_arrival' as AuditFilter, title: '1. Arrival', sudah: arrivalDone, belum: arrivalMissing },
            { key: 'missing_pdi' as AuditFilter, title: '2. PDI', sudah: pdiDone, belum: pdiMissing },
            { key: 'ms_overdue' as AuditFilter, title: '3. MS Overdue', sudah: Math.max(0, totalUnits - ms1Overdue), belum: ms1Overdue },
            { key: 'missing_csa_2026' as AuditFilter, title: '4. CSA 2026', sudah: Math.max(0, csaRequired - csaMissing), belum: csaMissing },
            { key: 'missing_comm' as AuditFilter, title: '5. COMM', sudah: commDone, belum: Math.max(0, totalUnits - commDone) },
            { key: 'complete' as AuditFilter, title: '6. Lengkap', sudah: processComplete, belum: Math.max(0, totalUnits - processComplete) },
          ]).map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => { setAuditFilter(card.key); setAuditPage(0) }}
              className={`text-left p-4 rounded-xl border transition-all ${
                auditFilter === card.key
                  ? 'bg-accent/10 border-accent/50 ring-1 ring-accent/30'
                  : 'bg-surface-950/60 border-surface-800 hover:border-surface-600'
              }`}
            >
              <p className="text-xs font-semibold text-surface-400 mb-2">{card.title}</p>
              <div className="flex justify-between text-xs">
                <span className="text-emerald-400">Sudah: {card.sudah.toLocaleString('id-ID')}</span>
                <span className="text-red-400">Belum: {card.belum.toLocaleString('id-ID')}</span>
              </div>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-surface-500 mt-2">
          MS DONE di process: MS1 {ms1Done} \u00b7 MS2 {ms2Done} \u00b7 MS3 {ms3Done} \u00b7 MS1 overdue (stock \u22653 bln): {ms1Overdue}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-surface-200">
            Audit Kepatuhan{' '}
            <span className="text-surface-400 font-normal">({auditTotal.toLocaleString('id-ID')} unit)</span>
          </h3>
          <button onClick={handleExport} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export halaman
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {filterTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setAuditFilter(t.key); setAuditPage(0) }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                auditFilter === t.key
                  ? 'bg-accent/15 border-accent/50 text-accent'
                  : t.danger
                    ? 'border-red-500/30 text-red-300'
                    : 'border-surface-700 text-surface-400'
              }`}
            >
              {t.label}{' '}
              {typeof t.count === 'number' ? t.count.toLocaleString('id-ID') : t.count}
            </button>
          ))}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            className="input pl-9 w-full text-sm"
            placeholder="Cari No Unit, VIN, Model, Cabang, Customer..."
            value={auditSearch}
            onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(0) }}
          />
          {auditSearch && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400" onClick={() => setAuditSearch('')}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {auditLoading ? (
          <TableSkeleton rows={8} cols={8} />
        ) : (
          <>
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-800 bg-surface-950/60 text-left text-surface-400 text-xs">
                      <th className="px-3 py-3">No Unit / VIN</th>
                      <th className="px-3 py-3">Model</th>
                      <th className="px-3 py-3">Cabang</th>
                      <th className="px-3 py-3">Tahun/BL</th>
                      <th className="px-3 py-3">Arrival</th>
                      <th className="px-3 py-3">PDI</th>
                      <th className="px-3 py-3">MS1</th>
                      <th className="px-3 py-3">CSA</th>
                      <th className="px-3 py-3">COMM</th>
                      <th className="px-3 py-3">Blocker</th>
                      <th className="px-3 py-3 text-right">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-800/40">
                    {auditRows.map((r: any) => (
                      <tr key={r.unit_id} className="hover:bg-surface-800/40 cursor-pointer" onClick={() => openUnit(r)}>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-xs text-surface-100">{r.unit_number}</div>
                          <div className="text-[10px] font-mono text-surface-500">{r.vin}</div>
                        </td>
                        <td className="px-3 py-2.5 text-xs font-semibold">{r.model || '\u2014'}</td>
                        <td className="px-3 py-2.5 text-xs text-surface-300">{r.under_cabang || '\u2014'}</td>
                        <td className="px-3 py-2.5 text-xs font-mono">
                          {r.year_delivery ?? '\u2014'}
                          {r.bl_date ? <div className="text-[10px] text-surface-500">{r.bl_date}</div> : null}
                        </td>
                        <td className="px-3 py-2.5"><GateBadge ok={!!r.gate_arrival} /></td>
                        <td className="px-3 py-2.5"><GateBadge ok={!!r.gate_pdi} /></td>
                        <td className="px-3 py-2.5"><GateBadge ok={r.ms_check_1 === 'DONE'} /></td>
                        <td className="px-3 py-2.5 text-[10px]">
                          {!r.csa_required ? (
                            <span className="text-surface-500">Non-2026</span>
                          ) : r.csa_status === 'uploaded' ? (
                            <span className="text-emerald-400">CSA OK</span>
                          ) : (
                            <span className="text-red-400">Belum CSA</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5"><GateBadge ok={!!r.gate_comm} /></td>
                        <td className="px-3 py-2.5 text-[10px] text-surface-400 max-w-[100px] truncate" title={r.process_blocker}>
                          {PROCESS_BLOCKER_LABELS[r.process_blocker] || r.process_blocker}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button type="button" className="p-1.5 text-surface-400 hover:text-accent" onClick={(e) => { e.stopPropagation(); openUnit(r) }}>
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-surface-400">
              <span>
                {auditRows.length ? auditPage * PAGE_SIZE + 1 : 0}\u2013{Math.min((auditPage + 1) * PAGE_SIZE, auditTotal)} / {auditTotal.toLocaleString('id-ID')}
              </span>
              <div className="flex gap-2">
                <button disabled={auditPage === 0} onClick={() => setAuditPage((p) => p - 1)} className="btn-secondary px-3 py-1 disabled:opacity-40">Prev</button>
                <span className="font-mono px-2">{auditPage + 1}/{auditPages}</span>
                <button disabled={auditPage >= auditPages - 1} onClick={() => setAuditPage((p) => p + 1)} className="btn-secondary px-3 py-1 disabled:opacity-40">Next</button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-surface-200 mb-4">Top Model</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {modelChartData.map((_, i) => (
                    <Cell key={i} fill={MODEL_COLORS[i % MODEL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-surface-200 mb-4">Populasi per Cabang</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cabangChartData}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {cabangChartData.map((_, i) => (
                    <Cell key={i} fill={CABANG_COLORS[i % CABANG_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {selectedUnit && <UnitDetailDrawer unit={selectedUnit} onClose={() => setSelectedUnit(null)} />}
      <AiUpdateModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />
    </div>
  )
}
