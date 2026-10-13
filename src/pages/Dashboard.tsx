import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, Unit } from '../lib/supabase'
import {
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Search,
  Download,
  Eye,
  Package,
  X,
  XCircle,
  Wrench,
  FileWarning,
} from 'lucide-react'
import { Skeleton, TableSkeleton, StatCardSkeleton } from '../components/Skeleton'
import { exportToCSV } from '../lib/exportUtils'
import { useRealtimeSync } from '../lib/useRealtimeSync'
import { LiveStatusBadge } from '../components/LiveNotification'
import UnitDetailDrawer from '../components/UnitDetailDrawer'

const PAGE_SIZE = 25

type PipelineFilter =
  | 'all'
  | 'complete_oldp'
  | 'no_oldp_sales'
  | 'sold_no_wo'
  | 'sold_no_pdi'
  | 'ms_due'
  | 'need_arrival'
  | 'sju_recon'
  | 'pure_stock'

const STAGE_LABEL: Record<string, string> = {
  COMPLETE_OLDP: 'Complete OLDP',
  SOLD_WO_PDI_NEED_OLDP_CLOSE: 'Sold+WO+PDI → closing OLDP',
  SOLD_WO_NEED_PDI: 'Sold+WO → perlu PDI',
  SOLD_NEED_PDI_AND_WO: 'Sold → perlu PDI & WO',
  SOLD_PDI_NEED_WO: 'Sold+PDI → perlu WO',
  SJU_NO_SALES_RECON: 'SJU tanpa sales — rekonsiliasi',
  STOCK_MS1_DUE: 'Stock MS1 due',
  STOCK_MS2_DUE: 'Stock MS2 due',
  STOCK_MS3_DUE: 'Stock MS3 due',
  NEED_ARRIVAL: 'Perlu isi arrival',
  STOCK_OK: 'Stock OK',
  IN_PROGRESS: 'In progress',
}

export default function Dashboard() {
  const { isLiveConnected, lastSyncTime } = useRealtimeSync()
  const [filter, setFilter] = useState<PipelineFilter>('no_oldp_sales')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null)

  const { data: summary, isLoading: sumLoading, refetch, isRefetching } = useQuery({
    queryKey: ['v_pipeline_summary'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_pipeline_summary').select('*').single()
      if (error) throw error
      return data as Record<string, number>
    },
  })

  const { data: pageData, isLoading: pageLoading } = useQuery({
    queryKey: ['v_unit_pipeline_page', filter, search, page],
    staleTime: 15_000,
    queryFn: async () => {
      let q = supabase
        .from('v_unit_pipeline')
        .select('*', { count: 'exact' })
        .order('stock_age_days_bl', { ascending: false, nullsFirst: false })

      if (filter === 'complete_oldp') q = q.eq('is_complete_oldp', true)
      else if (filter === 'no_oldp_sales') q = q.eq('is_complete_oldp', false)
      else if (filter === 'sold_no_wo')
        q = q.eq('is_complete_oldp', false).eq('has_penjualan', true).eq('has_wo_ax', false)
      else if (filter === 'sold_no_pdi')
        q = q.eq('is_complete_oldp', false).eq('has_penjualan', true).eq('has_pdi', false)
      else if (filter === 'ms_due') q = q.or('ms1_due.eq.true,ms2_due.eq.true,ms3_due.eq.true')
      else if (filter === 'need_arrival') q = q.eq('arrival_missing_overdue', true)
      else if (filter === 'sju_recon') q = q.eq('pipeline_stage', 'SJU_NO_SALES_RECON')
      else if (filter === 'pure_stock') q = q.eq('is_stock', true)

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
      bill_of_lading: r.bill_of_lading,
      status: 'aktif',
      created_at: '',
      updated_at: '',
    } as Unit)
  }

  const handleExport = () => {
    exportToCSV(
      'pipeline-sdlg',
      rows.map((r: any) => ({
        unit: r.unit_number,
        vin: r.vin,
        model: r.model,
        cabang: r.under_cabang,
        bl: r.bl_date,
        age_bl: r.stock_age_days_bl,
        oldp_sales: r.has_oldp_sales ? 'Y' : 'N',
        penjualan: r.has_penjualan ? 'Y' : 'N',
        sju: r.has_sju ? 'Y' : 'N',
        wo: r.has_wo_ax ? 'Y' : 'N',
        pdi: r.has_pdi ? 'Y' : 'N',
        stage: r.pipeline_stage,
        next: r.next_action,
      })),
      [
        { key: 'unit', label: 'Unit' },
        { key: 'vin', label: 'VIN' },
        { key: 'model', label: 'Model' },
        { key: 'cabang', label: 'Cabang' },
        { key: 'bl', label: 'BL Date' },
        { key: 'age_bl', label: 'Umur BL (hari)' },
        { key: 'oldp_sales', label: 'OLDP Sales' },
        { key: 'penjualan', label: 'Penjualan' },
        { key: 'sju', label: 'SJU' },
        { key: 'wo', label: 'WO AX' },
        { key: 'pdi', label: 'PDI' },
        { key: 'stage', label: 'Stage' },
        { key: 'next', label: 'Next Action' },
      ]
    )
  }

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

  const tabs: { key: PipelineFilter; label: string; count: number; danger?: boolean }[] = [
    { key: 'all', label: 'Semua', count: s.total_units || 0 },
    { key: 'complete_oldp', label: 'Complete OLDP', count: s.complete_oldp || 0 },
    { key: 'no_oldp_sales', label: 'Tanpa sales_date OLDP', count: s.no_oldp_sales || 0, danger: true },
    { key: 'sold_no_pdi', label: 'Sold tanpa PDI', count: s.sold_no_pdi || 0, danger: true },
    { key: 'sold_no_wo', label: 'Sold tanpa WO AX', count: s.sold_no_wo || 0, danger: true },
    { key: 'ms_due', label: 'MS due (stock)', count: s.ms1_due_count || 0 },
    { key: 'need_arrival', label: 'Arrival missing', count: s.arrival_missing_count || 0 },
    { key: 'sju_recon', label: 'SJU rekonsiliasi', count: s.stage_sju_recon || 0 },
    { key: 'pure_stock', label: 'Pure stock', count: s.pure_stock || 0 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-800">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">Pipeline Closing & Stock</h2>
          <p className="text-sm text-surface-400 mt-1">
            End-first: sales_date OLDP = complete · stock age dari BL · semua WO AX dihitung
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LiveStatusBadge isLive={isLiveConnected} lastSync={lastSyncTime} />
          <button onClick={() => refetch()} className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-2 text-emerald-400 text-xs mb-1">
            <CheckCircle2 className="w-4 h-4" /> Complete OLDP
          </div>
          <p className="text-3xl font-bold text-emerald-400">{(s.complete_oldp || 0).toLocaleString('id-ID')}</p>
          <p className="text-[11px] text-surface-500 mt-1">Punya sales_date (≈ commissioning SDLG)</p>
        </div>
        <div
          className="card p-4 border-red-500/30 bg-red-500/5 cursor-pointer"
          onClick={() => {
            setFilter('no_oldp_sales')
            setPage(0)
          }}
        >
          <div className="flex items-center gap-2 text-red-400 text-xs mb-1">
            <AlertCircle className="w-4 h-4" /> Fokus: tanpa sales_date
          </div>
          <p className="text-3xl font-bold text-red-400">{(s.no_oldp_sales || 0).toLocaleString('id-ID')}</p>
          <p className="text-[11px] text-surface-500 mt-1">
            Sold lokal {s.no_oldp_but_penjualan || 0} · pure stock {s.pure_stock || 0}
          </p>
        </div>
        <div
          className="card p-4 border-amber-500/20 cursor-pointer"
          onClick={() => {
            setFilter('sold_no_pdi')
            setPage(0)
          }}
        >
          <div className="flex items-center gap-2 text-amber-400 text-xs mb-1">
            <FileWarning className="w-4 h-4" /> Sold tanpa PDI
          </div>
          <p className="text-3xl font-bold text-amber-400">{(s.sold_no_pdi || 0).toLocaleString('id-ID')}</p>
          <p className="text-[11px] text-surface-500 mt-1">Wajib PDI sebelum kirim customer</p>
        </div>
        <div
          className="card p-4 border-blue-500/20 cursor-pointer"
          onClick={() => {
            setFilter('ms_due')
            setPage(0)
          }}
        >
          <div className="flex items-center gap-2 text-blue-400 text-xs mb-1">
            <Package className="w-4 h-4" /> MS1 due (dari BL)
          </div>
          <p className="text-3xl font-bold text-blue-400">{(s.ms1_due_count || 0).toLocaleString('id-ID')}</p>
          <p className="text-[11px] text-surface-500 mt-1">
            Arrival missing: {(s.arrival_missing_count || 0).toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="card p-3">
          <span className="text-surface-500">Sold + ada WO AX</span>
          <p className="text-lg font-bold text-surface-100">{(s.sold_with_wo || 0).toLocaleString('id-ID')}</p>
        </div>
        <div className="card p-3">
          <span className="text-surface-500">Sold tanpa WO AX</span>
          <p className="text-lg font-bold text-red-400">{(s.sold_no_wo || 0).toLocaleString('id-ID')}</p>
        </div>
        <div className="card p-3">
          <span className="text-surface-500">SJU tanpa OLDP sales</span>
          <p className="text-lg font-bold text-amber-400">{(s.no_oldp_has_sju || 0).toLocaleString('id-ID')}</p>
        </div>
        <div className="card p-3">
          <span className="text-surface-500">Total unit</span>
          <p className="text-lg font-bold text-surface-100">{(s.total_units || 0).toLocaleString('id-ID')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setFilter(t.key)
              setPage(0)
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
              filter === t.key
                ? 'bg-accent/15 border-accent/50 text-accent'
                : t.danger
                  ? 'border-red-500/30 text-red-300'
                  : 'border-surface-700 text-surface-400'
            }`}
          >
            {t.label} {t.count.toLocaleString('id-ID')}
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
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
              <X className="w-3.5 h-3.5 text-surface-400" />
            </button>
          )}
        </div>
        <button onClick={handleExport} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {pageLoading ? (
        <TableSkeleton rows={8} cols={8} />
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
                    <th className="px-3 py-3">OLDP</th>
                    <th className="px-3 py-3">Jual</th>
                    <th className="px-3 py-3">SJU</th>
                    <th className="px-3 py-3">WO AX</th>
                    <th className="px-3 py-3">PDI</th>
                    <th className="px-3 py-3">Stage</th>
                    <th className="px-3 py-3">Next action</th>
                    <th className="px-3 py-3 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/40">
                  {rows.map((r: any) => (
                    <tr
                      key={r.unit_id}
                      className="hover:bg-surface-800/40 cursor-pointer"
                      onClick={() => openUnit(r)}
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-xs">{r.unit_number}</div>
                        <div className="text-[10px] font-mono text-surface-500">{r.vin}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{r.under_cabang || '—'}</td>
                      <td className="px-3 py-2.5 text-xs font-mono">
                        {r.bl_date || '—'}
                        {r.stock_age_days_bl != null && (
                          <div className="text-[10px] text-surface-500">{r.stock_age_days_bl} hari</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.has_oldp_sales ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.has_penjualan ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-surface-600" />
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.has_sju ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-surface-600" />
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {r.has_wo_ax ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Wrench className="w-3 h-3" />
                            {r.wo_count}
                          </span>
                        ) : (
                          <span className="text-surface-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.has_pdi ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-surface-600" />
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-surface-300 max-w-[120px]">
                        {STAGE_LABEL[r.pipeline_stage] || r.pipeline_stage}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-amber-300/90 max-w-[160px]">{r.next_action}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          className="p-1.5 text-surface-400 hover:text-accent"
                          onClick={(e) => {
                            e.stopPropagation()
                            openUnit(r)
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-between text-xs text-surface-400">
            <span>
              {rows.length ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, total)} /{' '}
              {total.toLocaleString('id-ID')}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="btn-secondary px-3 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="font-mono px-2">
                {page + 1}/{pages}
              </span>
              <button
                disabled={page >= pages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary px-3 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {selectedUnit && <UnitDetailDrawer unit={selectedUnit} onClose={() => setSelectedUnit(null)} />}
    </div>
  )
}
