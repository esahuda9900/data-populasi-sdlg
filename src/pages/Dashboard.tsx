import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, Unit } from '../lib/supabase'
import {
  RefreshCw,
  CheckCircle2,
  Search,
  Download,
  Eye,
  X,
  XCircle,
} from 'lucide-react'
import { Skeleton, TableSkeleton, StatCardSkeleton } from '../components/Skeleton'
import { exportToCSV } from '../lib/exportUtils'
import { useRealtimeSync } from '../lib/useRealtimeSync'
import { LiveStatusBadge } from '../components/LiveNotification'
import UnitDetailDrawer from '../components/UnitDetailDrawer'

const PAGE_SIZE = 25

type TabKey =
  | 'complete'
  | 'wo_cabang'
  | 'keberangkatan'
  | 'pdi_csa'
  | 'sju_no_sales'
  | 'wo_no_sales'
  | 'ms_due'
  | 'arrival'
  | 'no_bl'
  | 'all_open'

const STAGE_LABEL: Record<string, string> = {
  COMPLETE_OLDP: 'Complete OLDP',
  SOLD_SJU_NEED_WO_COMM: 'Butuh WO commissioning',
  SOLD_NEED_DEPARTURE: 'Butuh keberangkatan',
  SOLD_NEED_PDI: 'Butuh PDI',
  SOLD_CHECK_CSA_THEN_PDI: 'Cek CSA 2026 → PDI',
  SOLD_WO_COMM_NEED_PDI: 'WO comm ada, butuh PDI',
  SOLD_READY_OLDP_CLOSE: 'Siap closing OLDP',
  SOLD_NEED_WO_COMM: 'Butuh WO commissioning',
  SJU_NO_SALES_RECON: 'SJU tanpa penjualan',
  WO_COMM_NO_SALES_CHECK: 'WO comm tanpa jual',
  STOCK_MS1_DUE: 'MS1 due',
  STOCK_MS2_DUE: 'MS2 due',
  STOCK_MS3_DUE: 'MS3 due',
  NEED_ARRIVAL: 'Butuh arrival',
  NO_BL_MANUAL: 'No BL — cek manual',
  STOCK_OK: 'Stock OK',
  IN_PROGRESS: 'In progress',
}

export default function Dashboard() {
  const { isLiveConnected, lastSyncTime } = useRealtimeSync()
  const [tab, setTab] = useState<TabKey>('wo_cabang')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null)

  const { data: summary, isLoading: sumLoading, refetch, isRefetching } = useQuery({
    queryKey: ['v_pipeline_summary_v1'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_pipeline_summary').select('*').single()
      if (error) throw error
      return data as Record<string, number>
    },
  })

  const { data: pageData, isLoading: pageLoading } = useQuery({
    queryKey: ['v_unit_pipeline_tab', tab, search, page],
    staleTime: 15_000,
    queryFn: async () => {
      let q = supabase
        .from('v_unit_pipeline')
        .select('*', { count: 'exact' })
        .order('stock_age_days_bl', { ascending: false, nullsFirst: false })

      if (tab === 'complete') q = q.eq('is_complete_oldp', true)
      else if (tab === 'wo_cabang')
        q = q.eq('is_complete_oldp', false).eq('has_penjualan', true).eq('has_sju', true).eq('has_wo_comm', false)
      else if (tab === 'keberangkatan')
        q = q.eq('is_complete_oldp', false).eq('has_penjualan', true).eq('has_sju', false)
      else if (tab === 'pdi_csa')
        q = q.eq('is_complete_oldp', false).eq('has_penjualan', true).or('has_pdi.eq.false,csa_now_due.eq.true')
      else if (tab === 'sju_no_sales')
        q = q.eq('is_complete_oldp', false).eq('has_sju', true).eq('has_penjualan', false)
      else if (tab === 'wo_no_sales')
        q = q.eq('is_complete_oldp', false).eq('has_wo_comm', true).eq('has_penjualan', false)
      else if (tab === 'ms_due') q = q.or('ms1_due.eq.true,ms2_due.eq.true,ms3_due.eq.true')
      else if (tab === 'arrival') q = q.eq('arrival_missing_overdue', true)
      else if (tab === 'no_bl') q = q.eq('no_bl', true).eq('is_complete_oldp', false)
      else if (tab === 'all_open') q = q.eq('is_complete_oldp', false)

      if (search.trim()) {
        const s = search.trim()
        q = q.or(
          `vin.ilike.%${s}%,unit_number.ilike.%${s}%,model.ilike.%${s}%,under_cabang.ilike.%${s}%,customer.ilike.%${s}%`
        )
      }

      const from = page * PAGE_SIZE
      const { data, error, count } = await q.range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      return { rows: data || [], total: count ?? 0 }
    },
  })

  const s = summary || {}
  const rows = pageData?.rows || []
  const total = pageData?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const openUnit = (r: any) => {
    setSelectedUnit({
      id: r.unit_id,
      vin: r.vin,
      unit_number: r.unit_number,
      model: r.model,
      under_cabang: r.under_cabang,
      customer: r.customer,
      year_delivery: r.year_delivery,
      status: 'aktif',
      created_at: '',
      updated_at: '',
    } as Unit)
  }

  const handleExport = () => {
    exportToCSV(
      `pipeline-${tab}`,
      rows.map((r: any) => ({
        unit: r.unit_number,
        vin: r.vin,
        model: r.model,
        cabang: r.under_cabang,
        bl: r.bl_date,
        age: r.stock_age_days_bl,
        jual: r.has_penjualan ? 'Y' : 'N',
        sju: r.has_sju ? 'Y' : 'N',
        wo_comm: r.has_wo_comm ? 'Y' : 'N',
        pdi: r.has_pdi ? 'Y' : 'N',
        stage: r.pipeline_stage,
        next: r.next_action,
        pic: r.pic,
      })),
      [
        { key: 'unit', label: 'Unit' },
        { key: 'vin', label: 'VIN' },
        { key: 'model', label: 'Model' },
        { key: 'cabang', label: 'Cabang' },
        { key: 'bl', label: 'BL' },
        { key: 'age', label: 'Umur BL hari' },
        { key: 'jual', label: 'Jual' },
        { key: 'sju', label: 'SJU' },
        { key: 'wo_comm', label: 'WO Comm' },
        { key: 'pdi', label: 'PDI' },
        { key: 'stage', label: 'Stage' },
        { key: 'next', label: 'Next' },
        { key: 'pic', label: 'PIC' },
      ]
    )
  }

  const tabs: { key: TabKey; label: string; count: number; pic: string; danger?: boolean }[] = [
    { key: 'wo_cabang', label: 'Butuh WO cabang', count: s.sold_sju_no_wo_comm || 0, pic: 'Cabang', danger: true },
    { key: 'keberangkatan', label: 'Butuh keberangkatan', count: s.sold_no_sju || 0, pic: 'Logistics' },
    { key: 'pdi_csa', label: 'PDI / CSA 2026', count: Math.max(s.sold_no_pdi || 0, s.csa_due_count || 0), pic: 'PDI / Dokumen' },
    { key: 'sju_no_sales', label: 'SJU tanpa jual', count: s.sju_no_penjualan || 0, pic: 'Data jual', danger: true },
    { key: 'wo_no_sales', label: 'WO tanpa jual', count: s.wo_comm_no_sales || 0, pic: 'Data quality' },
    { key: 'ms_due', label: 'Stock MS due', count: s.ms1_due_count || 0, pic: 'Workshop' },
    { key: 'arrival', label: 'Arrival missing', count: s.arrival_missing_count || 0, pic: 'Ops' },
    { key: 'no_bl', label: 'No BL (manual)', count: s.no_bl_count || 0, pic: 'Ops + Data' },
    { key: 'complete', label: 'Complete OLDP', count: s.complete_oldp || 0, pic: '—' },
    { key: 'all_open', label: 'Semua open', count: s.no_oldp_sales || 0, pic: 'Ops' },
  ]

  if (sumLoading && !summary) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-800">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">Antrian Proses Unit</h2>
          <p className="text-sm text-surface-400 mt-1">
            Jual → CSA(2026) → PDI → SJU → WO commissioning → sales_date OLDP · Stock: MS dari BL
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LiveStatusBadge isLive={isLiveConnected} lastSync={lastSyncTime} />
          <button type="button" onClick={() => refetch()} className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4 border-emerald-500/20 bg-emerald-500/5">
          <p className="text-[11px] text-emerald-400 font-semibold uppercase">Complete OLDP</p>
          <p className="text-2xl font-bold text-emerald-400">{(s.complete_oldp || 0).toLocaleString('id-ID')}</p>
        </div>
        <div className="card p-4 border-red-500/30 bg-red-500/5 cursor-pointer" onClick={() => { setTab('wo_cabang'); setPage(0) }}>
          <p className="text-[11px] text-red-400 font-semibold uppercase">PIC Cabang (WO)</p>
          <p className="text-2xl font-bold text-red-400">{(s.sold_sju_no_wo_comm || 0).toLocaleString('id-ID')}</p>
          <p className="text-[10px] text-surface-500">Sold + SJU, belum commissioning</p>
        </div>
        <div className="card p-4 border-amber-500/20 cursor-pointer" onClick={() => { setTab('keberangkatan'); setPage(0) }}>
          <p className="text-[11px] text-amber-400 font-semibold uppercase">PIC Keberangkatan</p>
          <p className="text-2xl font-bold text-amber-400">{(s.sold_no_sju || 0).toLocaleString('id-ID')}</p>
        </div>
        <div className="card p-4 border-blue-500/20 cursor-pointer" onClick={() => { setTab('ms_due'); setPage(0) }}>
          <p className="text-[11px] text-blue-400 font-semibold uppercase">MS1 due (stock)</p>
          <p className="text-2xl font-bold text-blue-400">{(s.ms1_due_count || 0).toLocaleString('id-ID')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setPage(0) }}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border text-left ${
              tab === t.key
                ? 'bg-accent/15 border-accent/50 text-accent'
                : t.danger
                  ? 'border-red-500/30 text-red-300 hover:bg-red-500/10'
                  : 'border-surface-700 text-surface-400 hover:bg-surface-800'
            }`}
          >
            <span className="block">{t.label}</span>
            <span className="text-[10px] opacity-80">
              {t.count.toLocaleString('id-ID')} · PIC: {t.pic}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            className="input pl-9 w-full text-sm"
            placeholder="Cari VIN, unit, model, cabang..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          />
          {search && (
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
              <X className="w-3.5 h-3.5 text-surface-400" />
            </button>
          )}
        </div>
        <button type="button" onClick={handleExport} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> Export tab
        </button>
      </div>

      {pageLoading ? (
        <TableSkeleton rows={8} cols={9} />
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800 bg-surface-950/60 text-left text-surface-400 text-xs">
                    <th className="px-3 py-3">Unit / VIN</th>
                    <th className="px-3 py-3">Cabang</th>
                    <th className="px-3 py-3">BL / Umur</th>
                    <th className="px-3 py-3">Jual</th>
                    <th className="px-3 py-3">SJU</th>
                    <th className="px-3 py-3">WO Comm</th>
                    <th className="px-3 py-3">PDI</th>
                    <th className="px-3 py-3">PIC</th>
                    <th className="px-3 py-3">Next action</th>
                    <th className="px-3 py-3 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/40">
                  {rows.map((r: any) => (
                    <tr key={r.unit_id} className="hover:bg-surface-800/40 cursor-pointer" onClick={() => openUnit(r)}>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-xs">{r.unit_number}</div>
                        <div className="text-[10px] font-mono text-surface-500">{r.vin}</div>
                        <div className="text-[10px] text-surface-600">{STAGE_LABEL[r.pipeline_stage] || r.pipeline_stage}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{r.under_cabang || '—'}</td>
                      <td className="px-3 py-2.5 text-xs font-mono">
                        {r.bl_date || '—'}
                        {r.stock_age_days_bl != null && (
                          <div className="text-[10px] text-surface-500">{r.stock_age_days_bl} hari</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">{r.has_penjualan ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-surface-600" />}</td>
                      <td className="px-3 py-2.5">{r.has_sju ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-surface-600" />}</td>
                      <td className="px-3 py-2.5">{r.has_wo_comm ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400/70" />}</td>
                      <td className="px-3 py-2.5">{r.has_pdi ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-surface-600" />}</td>
                      <td className="px-3 py-2.5 text-[10px] font-semibold text-accent">{r.pic || '—'}</td>
                      <td className="px-3 py-2.5 text-[10px] text-amber-300/90 max-w-[180px]">{r.next_action}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button type="button" className="p-1.5 text-surface-400 hover:text-accent" onClick={(e) => { e.stopPropagation(); openUnit(r) }}>
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-surface-500 text-sm">
                        Tidak ada unit di antrian ini
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-between text-xs text-surface-400">
            <span>
              {rows.length ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, total)} / {total.toLocaleString('id-ID')}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="btn-secondary px-3 py-1 disabled:opacity-40">Prev</button>
              <span className="font-mono px-2">{page + 1}/{pages}</span>
              <button type="button" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="btn-secondary px-3 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        </>
      )}

      {selectedUnit && <UnitDetailDrawer unit={selectedUnit} onClose={() => setSelectedUnit(null)} />}
    </div>
  )
}
