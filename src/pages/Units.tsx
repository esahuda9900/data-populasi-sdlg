import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, Unit } from '../lib/supabase'
import {
  Truck,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutGrid,
  List,
  Filter,
  Eye,
  X,
  Sparkles,
} from 'lucide-react'
import { exportToCSV } from '../lib/exportUtils'
import { useDebounce } from '../lib/useDebounce'
import { resolveUnitModel } from '../lib/modelUtils'
import UnitDetailDrawer from '../components/UnitDetailDrawer'
import { TableSkeleton } from '../components/Skeleton'

const PAGE_SIZE = 50

export default function Units() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [filterCabang, setFilterCabang] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterModelStatus, setFilterModelStatus] = useState<'all' | 'filled' | 'missing'>('all')
  const [page, setPage] = useState(0)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null)

  const { data: totalCount = 0 } = useQuery({
    queryKey: ['units_count'],
    queryFn: async () => {
      const { count } = await supabase.from('units').select('*', { count: 'exact', head: true })
      return count ?? 0
    },
  })

  const { data: cabangs = [] } = useQuery({
    queryKey: ['units_cabangs'],
    queryFn: async () => {
      const { data } = await supabase.from('units').select('under_cabang').limit(5000)
      const set = new Set((data || []).map((u: { under_cabang: string | null }) => u.under_cabang).filter(Boolean))
      return Array.from(set).sort() as string[]
    },
  })

  const { data: units = [], isLoading } = useQuery<Unit[]>({
    queryKey: ['units_page', page, debouncedSearch, filterCabang, filterStatus, filterModelStatus],
    queryFn: async () => {
      let q = supabase
        .from('units')
        .select('*')
        .order('unit_number')
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (filterCabang) {
        q = q.eq('under_cabang', filterCabang)
      }
      if (filterStatus) {
        q = q.eq('status', filterStatus)
      }
      if (filterModelStatus === 'missing') {
        q = q.or('model.is.null,model.eq.,model.eq.KOSONG,model.eq.Unknown')
      } else if (filterModelStatus === 'filled') {
        q = q.not('model', 'is', null).neq('model', '').neq('model', 'KOSONG').neq('model', 'Unknown')
      }

      if (debouncedSearch.trim()) {
        const s = debouncedSearch.trim()
        q = q.or(`vin.ilike.%${s}%,unit_number.ilike.%${s}%,model.ilike.%${s}%,serial_number.ilike.%${s}%,customer.ilike.%${s}%`)
      }

      const { data, error } = await q
      if (error) throw error
      return (data as Unit[]) || []
    },
  })

  const { data: filteredCount = 0 } = useQuery({
    queryKey: ['units_filtered_count', debouncedSearch, filterCabang, filterStatus, filterModelStatus],
    queryFn: async () => {
      let q = supabase.from('units').select('*', { count: 'exact', head: true })
      if (filterCabang) q = q.eq('under_cabang', filterCabang)
      if (filterStatus) q = q.eq('status', filterStatus)
      if (filterModelStatus === 'missing') {
        q = q.or('model.is.null,model.eq.,model.eq.KOSONG,model.eq.Unknown')
      } else if (filterModelStatus === 'filled') {
        q = q.not('model', 'is', null).neq('model', '').neq('model', 'KOSONG').neq('model', 'Unknown')
      }
      if (debouncedSearch.trim()) {
        const s = debouncedSearch.trim()
        q = q.or(`vin.ilike.%${s}%,unit_number.ilike.%${s}%,model.ilike.%${s}%,serial_number.ilike.%${s}%,customer.ilike.%${s}%`)
      }
      const { count } = await q
      return count ?? 0
    },
  })

  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))

  const handleExport = () => {
    const exportRows = units.map((u) => {
      const resolved = resolveUnitModel(u)
      return {
        unit_number: u.unit_number,
        vin: u.vin,
        model: resolved.model,
        customer: u.customer,
        under_cabang: u.under_cabang,
        location: u.location,
        status: u.status,
        serial_number: u.serial_number,
        year_delivery: u.year_delivery,
        marketing_status: u.marketing_status,
      }
    })

    exportToCSV(
      'data-populasi-sdlg-unit',
      exportRows,
      [
        { key: 'unit_number', label: 'No Unit' },
        { key: 'vin', label: 'VIN' },
        { key: 'model', label: 'Model' },
        { key: 'customer', label: 'Customer' },
        { key: 'under_cabang', label: 'Cabang' },
        { key: 'location', label: 'Lokasi' },
        { key: 'status', label: 'Status' },
        { key: 'serial_number', label: 'Serial Number' },
        { key: 'year_delivery', label: 'Tahun Delivery' },
        { key: 'marketing_status', label: 'Marketing' },
      ]
    )
  }

  const clearFilters = () => {
    setSearch('')
    setFilterCabang('')
    setFilterStatus('')
    setFilterModelStatus('all')
    setPage(0)
  }

  const hasActiveFilters = Boolean(search || filterCabang || filterStatus || filterModelStatus !== 'all')

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-surface-50">Populasi Unit SDLG</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-800 text-surface-300 border border-surface-700">
              {filteredCount.toLocaleString('id-ID')} Total
            </span>
          </div>
          <p className="text-sm text-surface-400 mt-1">
            Database armada lengkap dengan sistem pelacakan otomatis model, VIN, dan cabang
          </p>
        </div>

        {/* View Toggle & Export */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex items-center p-1 bg-surface-900 border border-surface-800 rounded-lg">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-surface-800 text-surface-100' : 'text-surface-400 hover:text-surface-200'
              }`}
              title="Tampilan Tabel"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'card' ? 'bg-surface-800 text-surface-100' : 'text-surface-400 hover:text-surface-200'
              }`}
              title="Tampilan Card"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleExport}
            disabled={units.length === 0}
            className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5 text-accent" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              type="text"
              placeholder="Cari berdasarkan No Unit, VIN, Model, atau Customer..."
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

          <div className="flex flex-wrap gap-2">
            <select
              value={filterCabang}
              onChange={(e) => {
                setFilterCabang(e.target.value)
                setPage(0)
              }}
              className="input text-sm w-full sm:w-40"
            >
              <option value="">Semua Cabang</option>
              {cabangs.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value)
                setPage(0)
              }}
              className="input text-sm w-full sm:w-32"
            >
              <option value="">Semua Status</option>
              <option value="aktif">Aktif</option>
              <option value="idle">Idle</option>
            </select>

            <select
              value={filterModelStatus}
              onChange={(e) => {
                setFilterModelStatus(e.target.value as any)
                setPage(0)
              }}
              className="input text-sm w-full sm:w-44"
            >
              <option value="all">Semua Status Model</option>
              <option value="filled">Model Sudah Terisi</option>
              <option value="missing">Model Perlu Dilengkapi</option>
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 pt-2 border-t border-surface-800 text-xs flex-wrap">
            <span className="text-surface-400 flex items-center gap-1">
              <Filter className="w-3 h-3 text-accent" /> Filter Aktif:
            </span>
            {search && (
              <span className="px-2 py-0.5 rounded bg-surface-800 text-surface-200 flex items-center gap-1">
                Pencarian: "{search}"
                <button onClick={() => setSearch('')} className="hover:text-red-400">×</button>
              </span>
            )}
            {filterCabang && (
              <span className="px-2 py-0.5 rounded bg-surface-800 text-surface-200 flex items-center gap-1">
                Cabang: {filterCabang}
                <button onClick={() => setFilterCabang('')} className="hover:text-red-400">×</button>
              </span>
            )}
            {filterStatus && (
              <span className="px-2 py-0.5 rounded bg-surface-800 text-surface-200 flex items-center gap-1">
                Status: {filterStatus}
                <button onClick={() => setFilterStatus('')} className="hover:text-red-400">×</button>
              </span>
            )}
            {filterModelStatus !== 'all' && (
              <span className="px-2 py-0.5 rounded bg-surface-800 text-surface-200 flex items-center gap-1">
                Model: {filterModelStatus === 'missing' ? 'Perlu Dilengkapi' : 'Sudah Terisi'}
                <button onClick={() => setFilterModelStatus('all')} className="hover:text-red-400">×</button>
              </span>
            )}
            <button
              onClick={clearFilters}
              className="text-accent hover:underline ml-auto font-medium"
            >
              Reset Semua
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : units.length === 0 ? (
        <div className="card text-center py-16 space-y-3">
          <Truck className="w-12 h-12 text-surface-600 mx-auto" />
          <h3 className="text-base font-semibold text-surface-200">Tidak ada unit ditemukan</h3>
          <p className="text-xs text-surface-400 max-w-sm mx-auto">
            Tidak ada unit yang cocok dengan kriteria pencarian atau filter yang dipilih.
          </p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="btn-primary text-xs mt-2">
              Bersihkan Filter
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* Table View with Sticky Unit Identification Column */
        <div className="card overflow-hidden p-0 shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-800 bg-surface-950/60 text-left text-surface-400">
                  <th className="px-4 py-3 font-semibold sticky left-0 bg-surface-950 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    No Unit & VIN
                  </th>
                  <th className="px-4 py-3 font-semibold">Model Alat</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Cabang</th>
                  <th className="px-4 py-3 font-semibold">Lokasi</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Marketing</th>
                  <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/40">
                {units.map((unit) => {
                  const resolvedModel = resolveUnitModel(unit)
                  return (
                    <tr
                      key={unit.id}
                      onClick={() => setSelectedUnit(unit)}
                      className="hover:bg-surface-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3 sticky left-0 bg-surface-900 group-hover:bg-surface-850 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                        <div className="font-semibold text-surface-100 group-hover:text-accent transition-colors flex items-center gap-1.5">
                          {unit.unit_number}
                        </div>
                        <div className="text-xs text-surface-400 font-mono mt-0.5">{unit.vin || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {resolvedModel.model === 'Perlu Dilengkapi' ? (
                            <span className="text-[11px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-500/20">
                              Perlu Dilengkapi
                            </span>
                          ) : (
                            <span className="text-surface-100 font-bold text-sm">
                              {resolvedModel.model}
                            </span>
                          )}
                          {resolvedModel.isAutoInferred && resolvedModel.model !== 'Perlu Dilengkapi' && (
                            <span
                              className="text-[10px] text-blue-400 font-normal"
                              title={`Terdeteksi otomatis dari ${resolvedModel.sourceField}`}
                            >
                              ✨
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-surface-300 max-w-[180px] truncate" title={unit.customer || ''}>
                        {unit.customer || '—'}
                      </td>
                      <td className="px-4 py-3 text-surface-300">{unit.under_cabang || '—'}</td>
                      <td className="px-4 py-3 text-surface-400 max-w-[150px] truncate" title={unit.location || ''}>
                        {unit.location || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                            unit.status === 'aktif'
                              ? 'bg-accent/15 text-accent border border-accent/20'
                              : unit.status === 'idle'
                              ? 'bg-amber-400/15 text-amber-400 border border-amber-400/20'
                              : 'bg-surface-800 text-surface-400'
                          }`}
                        >
                          {unit.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-surface-400 text-xs">{unit.marketing_status || '—'}</td>
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
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Mobile/Adaptive Card View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.map((unit) => {
            const resolvedModel = resolveUnitModel(unit)
            return (
              <div
                key={unit.id}
                onClick={() => setSelectedUnit(unit)}
                className="card p-4 hover:border-accent/40 cursor-pointer transition-all space-y-3 group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-base text-surface-100 group-hover:text-accent transition-colors">
                      {unit.unit_number}
                    </h4>
                    <p className="text-xs font-mono text-surface-400">{unit.vin || 'VIN: —'}</p>
                  </div>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                      unit.status === 'aktif'
                        ? 'bg-accent/15 text-accent'
                        : unit.status === 'idle'
                        ? 'bg-amber-400/15 text-amber-400'
                        : 'bg-surface-800 text-surface-400'
                    }`}
                  >
                    {unit.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-surface-300 pt-2 border-t border-surface-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-surface-500">Model:</span>
                    <span className="font-bold text-surface-100 flex items-center gap-1">
                      {resolvedModel.model}
                      {resolvedModel.isAutoInferred && resolvedModel.model !== 'Perlu Dilengkapi' && (
                        <Sparkles className="w-2.5 h-2.5 text-blue-400" />
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-500">Cabang:</span>
                    <span className="text-surface-200">{unit.under_cabang || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-500">Customer:</span>
                    <span className="text-surface-200 truncate max-w-[150px]">{unit.customer || '—'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-surface-800 flex items-center justify-between text-xs text-accent font-medium">
                  <span>Buka Detail & Ubah Model</span>
                  <Eye className="w-3.5 h-3.5" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <p className="text-xs text-surface-400">
          Menampilkan baris {units.length > 0 ? page * PAGE_SIZE + 1 : 0} -{' '}
          {Math.min((page + 1) * PAGE_SIZE, filteredCount)} dari {filteredCount.toLocaleString('id-ID')} unit
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
