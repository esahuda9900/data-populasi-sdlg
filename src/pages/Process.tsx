import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, UnitWithProcess } from '../lib/supabase'
import {
  AlertCircle,
  CheckCircle2,
  Search,
  ClipboardList,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  X,
  ShieldAlert,
  Clock,
} from 'lucide-react'
import { exportToCSV } from '../lib/exportUtils'
import { useDebounce } from '../lib/useDebounce'
import { resolveUnitModel } from '../lib/modelUtils'
import { PROCESS_BLOCKER_LABELS } from '../lib/complianceUtils'
import UnitDetailDrawer from '../components/UnitDetailDrawer'
import { TableSkeleton } from '../components/Skeleton'

const PAGE_SIZE = 50

type ProcessFilter =
  | 'all'
  | 'critical_gap'
  | 'ms_overdue'
  | 'csa_2026'
  | 'missing_arrival'
  | 'missing_pdi'
  | 'missing_comm'
  | 'complete'

function StatusBadge({ value }: { value: string | null | undefined }) {
  if (!value || value === '' || value === 'KOSONG') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-red-400/15 text-red-400 border border-red-500/20">
        <XCircle className="w-3.5 h-3.5" /> KOSONG
      </span>
    )
  }
  if (value === 'DONE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="w-3.5 h-3.5" /> DONE
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-amber-400/15 text-amber-400 border border-amber-500/20">
      <AlertCircle className="w-3.5 h-3.5" /> {value}
    </span>
  )
}

function BlockerBadge({ blocker }: { blocker: string | null | undefined }) {
  if (!blocker) return <span className="text-surface-500 text-xs">—</span>
  const label = PROCESS_BLOCKER_LABELS[blocker] || blocker
  const danger = ['MISSING_ARRIVAL', 'CSA_2026_MISSING', 'MISSING_PDI', 'MISSING_COMM'].includes(blocker)
  const warn = blocker.startsWith('MS')
  const ok = blocker === 'COMPLETE'
  const cls = ok
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
    : danger
      ? 'bg-red-400/15 text-red-400 border-red-500/20'
      : warn
        ? 'bg-amber-400/15 text-amber-400 border-amber-500/20'
        : 'bg-surface-800 text-surface-300 border-surface-700'
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${cls}`}>
      {label}
    </span>
  )
}

export default function Process() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [filter, setFilter] = useState<ProcessFilter>('all')
  const [page, setPage] = useState(0)
  const [selectedUnit, setSelectedUnit] = useState<UnitWithProcess | null>(null)

  const { data: summary } = useQuery({
    queryKey: ['process_compliance_summary'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_compliance_summary').select('*').single()
      if (error) throw error
      return data as {
        total_units: number
        arrival_missing: number
        pdi_missing: number
        critical_gap_count: number
        ms1_overdue_count: number
        csa_missing_count: number
        process_complete_count: number
        comm_done: number
      }
    },
  })

  const { data: queryResult, isLoading } = useQuery({
    queryKey: ['process_compliance_page', page, debouncedSearch, filter],
    queryFn: async () => {
      let q = supabase
        .from('v_unit_compliance')
        .select('*', { count: 'exact' })
        .order('unit_number')

      if (filter === 'critical_gap') q = q.eq('is_critical_gap', true)
      else if (filter === 'ms_overdue')
        q = q.or('ms1_overdue.eq.true,ms2_overdue.eq.true,ms3_overdue.eq.true')
      else if (filter === 'csa_2026') q = q.eq('csa_required', true).neq('csa_status', 'uploaded')
      else if (filter === 'missing_arrival') q = q.eq('gate_arrival', false)
      else if (filter === 'missing_pdi') q = q.eq('gate_pdi', false)
      else if (filter === 'missing_comm') q = q.eq('gate_comm', false)
      else if (filter === 'complete') q = q.eq('is_process_complete', true)

      if (debouncedSearch.trim()) {
        const s = debouncedSearch.trim()
        q = q.or(
          `vin.ilike.%${s}%,unit_number.ilike.%${s}%,model.ilike.%${s}%,customer.ilike.%${s}%,under_cabang.ilike.%${s}%`
        )
      }

      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, error, count } = await q.range(from, to)
      if (error) throw error

      const rows: UnitWithProcess[] = (data || []).map((r: any) => ({
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
        process: {
          id: '',
          vin: r.vin,
          arrival_check: r.arrival_check,
          pdi_check: r.pdi_check,
          comm_check: r.comm_check,
          ms_check_1: r.ms_check_1,
          ms_check_2: r.ms_check_2,
          ms_check_3: r.ms_check_3,
        },
        _compliance: r,
      }))

      return { rows, totalFiltered: count ?? 0, raw: data || [] }
    },
  })

  const rows = queryResult?.rows || []
  const rawRows = (queryResult as any)?.raw || []
  const totalFiltered = queryResult?.totalFiltered ?? summary?.total_units ?? 0
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))

  const handleExport = () => {
    const exportData = rawRows.map((r: any) => ({
      unit_number: r.unit_number,
      vin: r.vin,
      model: r.model,
      customer: r.customer,
      cabang: r.under_cabang,
      arrival: r.arrival_check || 'KOSONG',
      ms1: r.ms_check_1 || 'KOSONG',
      pdi: r.pdi_check || 'KOSONG',
      comm: r.comm_check || 'KOSONG',
      blocker: r.process_blocker,
      critical: r.is_critical_gap ? 'YES' : 'NO',
    }))
    exportToCSV('tracking-process-sdlg', exportData, [
      { key: 'unit_number', label: 'No Unit' },
      { key: 'vin', label: 'VIN' },
      { key: 'model', label: 'Model' },
      { key: 'customer', label: 'Customer' },
      { key: 'cabang', label: 'Cabang' },
      { key: 'arrival', label: 'Arrival' },
      { key: 'ms1', label: 'MS1' },
      { key: 'pdi', label: 'PDI' },
      { key: 'comm', label: 'COMM' },
      { key: 'blocker', label: 'Blocker' },
      { key: 'critical', label: 'Critical Gap' },
    ])
  }

  const filterCards: { key: ProcessFilter; label: string; count: number | string; color: string; icon?: 'shield' | 'clock' }[] = [
    { key: 'all', label: 'Semua Unit', count: summary?.total_units ?? '—', color: 'text-surface-100' },
    {
      key: 'critical_gap',
      label: 'Critical Gap',
      count: summary?.critical_gap_count ?? '—',
      color: 'text-red-400',
      icon: 'shield',
    },
    {
      key: 'ms_overdue',
      label: 'MS Overdue',
      count: summary?.ms1_overdue_count ?? '—',
      color: 'text-amber-400',
      icon: 'clock',
    },
    {
      key: 'csa_2026',
      label: 'CSA 2026',
      count: summary?.csa_missing_count ?? '—',
      color: 'text-orange-400',
    },
    {
      key: 'missing_arrival',
      label: 'Arrival kosong',
      count: summary?.arrival_missing ?? '—',
      color: 'text-blue-400',
    },
    {
      key: 'missing_pdi',
      label: 'PDI kosong',
      count: summary?.pdi_missing ?? '—',
      color: 'text-rose-400',
    },
    {
      key: 'missing_comm',
      label: 'COMM kosong',
      count:
        summary != null
          ? Math.max(0, (summary.total_units || 0) - (summary.comm_done || 0))
          : '—',
      color: 'text-violet-400',
    },
    {
      key: 'complete',
      label: 'Proses lengkap',
      count: summary?.process_complete_count ?? '—',
      color: 'text-emerald-400',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-surface-50">Pelacakan Proses Armada</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-800 text-surface-300 border border-surface-700">
              {totalFiltered.toLocaleString('id-ID')} Unit
            </span>
          </div>
          <p className="text-sm text-surface-400 mt-1">
            Gate berurutan: Arrival → MS (stock ≥3 bln) → Sold → CSA 2026 → PDI → Delivery → Commissioning
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={rawRows.length === 0}
          className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5 text-accent" />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {filterCards.map((f) => {
          const isSelected = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => {
                setFilter(f.key)
                setPage(0)
              }}
              className={`card text-left p-3 transition-all relative overflow-hidden ${
                isSelected
                  ? 'border-accent/60 bg-accent/5 ring-1 ring-accent/30'
                  : 'hover:border-surface-700'
              }`}
            >
              <div className="flex items-center gap-1">
                {f.icon === 'shield' && <ShieldAlert className="w-3.5 h-3.5 text-red-400" />}
                {f.icon === 'clock' && <Clock className="w-3.5 h-3.5 text-amber-400" />}
                <p className={`text-lg font-bold ${f.color} tracking-tight`}>
                  {typeof f.count === 'number' ? f.count.toLocaleString('id-ID') : f.count}
                </p>
              </div>
              <p className="text-[10px] text-surface-400 mt-0.5 font-medium leading-tight">{f.label}</p>
              {isSelected && <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-accent" />}
            </button>
          )
        })}
      </div>

      <div className="card p-3 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            type="text"
            placeholder="Cari VIN, Unit, Model, Customer, Cabang..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            className="input pl-9 w-full text-sm"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('')
                setPage(0)
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="text-xs text-surface-400 flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-accent" />
          Data dari engine compliance (v_unit_compliance)
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={8} />
      ) : rows.length === 0 ? (
        <div className="card text-center py-16 space-y-3">
          <ClipboardList className="w-12 h-12 text-surface-600 mx-auto" />
          <h3 className="text-base font-semibold text-surface-200">Tidak ada unit ditemukan</h3>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0 shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800 bg-surface-950/60 text-left text-surface-400">
                    <th className="px-3 py-3 font-semibold sticky left-0 bg-surface-950 z-10">Unit / VIN</th>
                    <th className="px-3 py-3 font-semibold">Model</th>
                    <th className="px-3 py-3 font-semibold">Cabang</th>
                    <th className="px-3 py-3 font-semibold">Arrival</th>
                    <th className="px-3 py-3 font-semibold">MS1</th>
                    <th className="px-3 py-3 font-semibold">PDI</th>
                    <th className="px-3 py-3 font-semibold">COMM</th>
                    <th className="px-3 py-3 font-semibold">Blocker</th>
                    <th className="px-3 py-3 font-semibold text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/40">
                  {rows.map((unit, idx) => {
                    const c = rawRows[idx] as any
                    return (
                      <tr
                        key={unit.id}
                        onClick={() => setSelectedUnit(unit)}
                        className="hover:bg-surface-800/40 cursor-pointer transition-colors group"
                      >
                        <td className="px-3 py-2.5 sticky left-0 bg-surface-900 group-hover:bg-surface-850 z-10">
                          <div className="font-semibold text-surface-100 group-hover:text-accent text-xs">
                            {unit.unit_number}
                          </div>
                          <div className="text-[10px] text-surface-400 font-mono">{unit.vin || '—'}</div>
                        </td>
                        <td className="px-3 py-2.5 text-surface-200 font-semibold text-xs">
                          {resolveUnitModel(unit).model}
                        </td>
                        <td className="px-3 py-2.5 text-surface-300 text-xs">{unit.under_cabang || '—'}</td>
                        <td className="px-3 py-2.5">
                          <StatusBadge value={unit.process?.arrival_check} />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge value={(unit.process as any)?.ms_check_1} />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge value={unit.process?.pdi_check} />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge value={unit.process?.comm_check} />
                        </td>
                        <td className="px-3 py-2.5">
                          <BlockerBadge blocker={c?.process_blocker} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedUnit(unit)
                            }}
                            className="p-1.5 rounded-lg text-surface-400 hover:text-accent"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <p className="text-xs text-surface-400">
              {rows.length > 0 ? page * PAGE_SIZE + 1 : 0}–
              {Math.min((page + 1) * PAGE_SIZE, totalFiltered)} dari{' '}
              {totalFiltered.toLocaleString('id-ID')}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="text-xs text-surface-300 px-2 font-mono">
                {page + 1}/{totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {selectedUnit && (
        <UnitDetailDrawer unit={selectedUnit} onClose={() => setSelectedUnit(null)} />
      )}
    </div>
  )
}
