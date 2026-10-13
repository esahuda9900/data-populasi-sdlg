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
} from 'lucide-react'
import { exportToCSV } from '../lib/exportUtils'
import { useDebounce } from '../lib/useDebounce'
import { resolveUnitModel } from '../lib/modelUtils'
import UnitDetailDrawer from '../components/UnitDetailDrawer'
import { TableSkeleton } from '../components/Skeleton'

const PAGE_SIZE = 50

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

export default function Process() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [filter, setFilter] = useState<'all' | 'missing_pdi' | 'missing_comm' | 'missing_arrival'>('all')
  const [page, setPage] = useState(0)
  const [selectedUnit, setSelectedUnit] = useState<UnitWithProcess | null>(null)

  // Fetch summary counts
  const { data: summary } = useQuery({
    queryKey: ['process_summary'],
    queryFn: async () => {
      const { count: total } = await supabase.from('unit_process').select('*', { count: 'exact', head: true })
      const { data: rows } = await supabase
        .from('unit_process')
        .select('pdi_check, comm_check, arrival_check')
        .limit(10000)
      let pdi = 0, comm = 0, arrival = 0
      for (const r of rows || []) {
        if (!r.pdi_check || r.pdi_check === 'KOSONG') pdi++
        if (!r.comm_check || r.comm_check === 'KOSONG') comm++
        if (!r.arrival_check || r.arrival_check === 'KOSONG') arrival++
      }
      return { total: total ?? 0, pdi, comm, arrival }
    },
  })

  // Fetch paginated process items
  const { data: queryResult, isLoading } = useQuery<{ rows: UnitWithProcess[]; totalFiltered: number }>({
    queryKey: ['process_page_data', page, debouncedSearch, filter],
    queryFn: async () => {
      // 1. If filtering by missing check, query matching process rows first
      if (filter !== 'all') {
        let procQuery = supabase.from('unit_process').select('vin, arrival_check, pdi_check, comm_check')
        if (filter === 'missing_pdi') {
          procQuery = procQuery.or('pdi_check.is.null,pdi_check.eq.KOSONG')
        } else if (filter === 'missing_comm') {
          procQuery = procQuery.or('comm_check.is.null,comm_check.eq.KOSONG')
        } else if (filter === 'missing_arrival') {
          procQuery = procQuery.or('arrival_check.is.null,arrival_check.eq.KOSONG')
        }

        const { data: matchingProc, error: procErr } = await procQuery.limit(5000)
        if (procErr) throw procErr

        const matchingVins = (matchingProc || []).map((p: { vin: string | null }) => p.vin).filter(Boolean) as string[]
        if (matchingVins.length === 0) {
          return { rows: [], totalFiltered: 0 }
        }

        const procMap = new Map((matchingProc || []).map((p: any) => [p.vin, p]))

        // Fetch units for these VINs
        let uQuery = supabase
          .from('units')
          .select('*')
          .in('vin', matchingVins)
          .order('unit_number')

        if (debouncedSearch.trim()) {
          const s = debouncedSearch.trim()
          uQuery = uQuery.or(`vin.ilike.%${s}%,unit_number.ilike.%${s}%,model.ilike.%${s}%,customer.ilike.%${s}%`)
        }

        // Get total count
        const { count: filteredCount } = await uQuery.select('*', { count: 'exact', head: true })

        // Page slice
        const { data: units, error: uErr } = await uQuery.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
        if (uErr) throw uErr

        const combined: UnitWithProcess[] = (units || []).map((u: any) => ({
          ...u,
          process: procMap.get(u.vin) || null,
        }))

        return { rows: combined, totalFiltered: filteredCount ?? combined.length }
      }

      // Default: filter === 'all'
      let unitQ = supabase
        .from('units')
        .select('*')
        .order('unit_number')

      if (debouncedSearch.trim()) {
        const s = debouncedSearch.trim()
        unitQ = unitQ.or(`vin.ilike.%${s}%,unit_number.ilike.%${s}%,model.ilike.%${s}%,customer.ilike.%${s}%`)
      }

      const { count: totalUnits } = await unitQ.select('*', { count: 'exact', head: true })

      const { data: units, error } = await unitQ.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error

      const vins = (units || []).map((u: { vin: string | null }) => u.vin).filter(Boolean) as string[]
      let procMap = new Map()

      if (vins.length > 0) {
        const { data: processes } = await supabase
          .from('unit_process')
          .select('vin, arrival_check, pdi_check, comm_check')
          .in('vin', vins)
        procMap = new Map((processes || []).map((p: any) => [p.vin, p]))
      }

      const combined: UnitWithProcess[] = (units || []).map((u: any) => ({
        ...u,
        process: procMap.get(u.vin) || null,
      }))

      return { rows: combined, totalFiltered: totalUnits ?? combined.length }
    },
  })

  const rows = queryResult?.rows || []
  const totalFiltered = queryResult?.totalFiltered ?? summary?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))

  const handleExport = () => {
    const exportData = rows.map((r) => ({
      unit_number: r.unit_number,
      vin: r.vin,
      model: resolveUnitModel(r).model,
      customer: r.customer,
      cabang: r.under_cabang,
      arrival_check: r.process?.arrival_check || 'KOSONG',
      pdi_check: r.process?.pdi_check || 'KOSONG',
      comm_check: r.process?.comm_check || 'KOSONG',
    }))

    exportToCSV('tracking-process-sdlg', exportData, [
      { key: 'unit_number', label: 'No Unit' },
      { key: 'vin', label: 'VIN' },
      { key: 'model', label: 'Model' },
      { key: 'customer', label: 'Customer' },
      { key: 'cabang', label: 'Cabang' },
      { key: 'arrival_check', label: 'Arrival Check' },
      { key: 'pdi_check', label: 'PDI Check' },
      { key: 'comm_check', label: 'Commissioning Check' },
    ])
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-surface-50">Pelacakan Proses Armada</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-800 text-surface-300 border border-surface-700">
              {totalFiltered.toLocaleString('id-ID')} Unit
            </span>
          </div>
          <p className="text-sm text-surface-400 mt-1">
            Status inspeksi bertahap: Kedatangan (Arrival), PDI (Pre-Delivery Inspection), dan Uji Kerja (COMM)
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExport}
            disabled={rows.length === 0}
            className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5 text-accent" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Category Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'all', label: 'Semua Armada', count: summary?.total ?? '—', color: 'text-surface-100' },
          { key: 'missing_pdi', label: 'PDI Tertunda', count: summary?.pdi ?? '—', color: 'text-red-400' },
          { key: 'missing_comm', label: 'COMM Tertunda', count: summary?.comm ?? '—', color: 'text-amber-400' },
          { key: 'missing_arrival', label: 'Arrival Tertunda', count: summary?.arrival ?? '—', color: 'text-blue-400' },
        ].map((f) => {
          const isSelected = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => {
                setFilter(f.key as any)
                setPage(0)
              }}
              className={`card text-left p-4 transition-all relative overflow-hidden ${
                isSelected
                  ? 'border-accent/60 bg-accent/5 ring-1 ring-accent/30 shadow-md'
                  : 'hover:border-surface-700 hover:bg-surface-800/40'
              }`}
            >
              <p className={`text-2xl font-bold ${f.color} tracking-tight`}>
                {typeof f.count === 'number' ? f.count.toLocaleString('id-ID') : f.count}
              </p>
              <p className="text-xs text-surface-400 mt-1 font-medium">{f.label}</p>
              {isSelected && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent" />
              )}
            </button>
          )
        })}
      </div>

      {/* Search Bar */}
      <div className="card p-3 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            type="text"
            placeholder="Cari VIN, Unit, Model, atau Customer..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            className="input pl-9 w-full text-sm"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(0) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="text-xs text-surface-400 self-start sm:self-auto flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-accent" />
          <span>Klik baris untuk membuka Detail 360° & Spesifikasi Unit</span>
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : rows.length === 0 ? (
        <div className="card text-center py-16 space-y-3">
          <ClipboardList className="w-12 h-12 text-surface-600 mx-auto" />
          <h3 className="text-base font-semibold text-surface-200">Tidak ada unit ditemukan</h3>
          <p className="text-xs text-surface-400 max-w-sm mx-auto">
            Tidak ada unit yang cocok dengan kriteria filter "{filter}" atau pencarian Anda.
          </p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0 shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800 bg-surface-950/60 text-left text-surface-400">
                    <th className="px-4 py-3 font-semibold sticky left-0 bg-surface-950 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                      Unit / VIN
                    </th>
                    <th className="px-4 py-3 font-semibold">Model</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Cabang</th>
                    <th className="px-4 py-3 font-semibold">1. Arrival</th>
                    <th className="px-4 py-3 font-semibold">2. PDI</th>
                    <th className="px-4 py-3 font-semibold">3. COMM</th>
                    <th className="px-4 py-3 font-semibold text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/40">
                  {rows.map((unit) => (
                    <tr
                      key={unit.id}
                      onClick={() => setSelectedUnit(unit)}
                      className="hover:bg-surface-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3 sticky left-0 bg-surface-900 group-hover:bg-surface-850 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                        <div className="font-semibold text-surface-100 group-hover:text-accent transition-colors">
                          {unit.unit_number}
                        </div>
                        <div className="text-xs text-surface-400 font-mono mt-0.5">{unit.vin || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-surface-200 font-semibold text-xs">
                        {resolveUnitModel(unit).model}
                      </td>
                      <td className="px-4 py-3 text-surface-300 max-w-[160px] truncate" title={unit.customer || ''}>
                        {unit.customer || '—'}
                      </td>
                      <td className="px-4 py-3 text-surface-300">{unit.under_cabang || '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={unit.process?.arrival_check} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={unit.process?.pdi_check} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={unit.process?.comm_check} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedUnit(unit)
                          }}
                          className="p-1.5 rounded-lg text-surface-400 hover:text-accent hover:bg-surface-800 transition-colors"
                          title="Lihat Detail 360°"
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

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <p className="text-xs text-surface-400">
              Menampilkan {rows.length > 0 ? page * PAGE_SIZE + 1 : 0} -{' '}
              {Math.min((page + 1) * PAGE_SIZE, totalFiltered)} dari {totalFiltered.toLocaleString('id-ID')} unit
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </button>
              <span className="text-xs text-surface-300 px-2 font-mono">
                {page + 1} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40"
              >
                Berikutnya <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

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
