import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  Plus,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Building,
  CheckSquare,
  Square,
  Trash2,
  Loader2,
  Calendar,
  AlertTriangle,
} from 'lucide-react'
import { exportToCSV } from '../lib/exportUtils'
import { useDebounce } from '../lib/useDebounce'
import { resolveUnitModel, batchSyncMissingModels } from '../lib/modelUtils'
import UnitDetailDrawer from '../components/UnitDetailDrawer'
import { TableSkeleton } from '../components/Skeleton'
import CreateUnitModal from '../components/CreateUnitModal'
import BulkImportModal from '../components/BulkImportModal'
import AiUpdateModal from '../components/AiUpdateModal'

const PAGE_SIZE = 50

export default function Units() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [filterCabang, setFilterCabang] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterModelStatus, setFilterModelStatus] = useState<'all' | 'filled' | 'missing'>('all')
  const [page, setPage] = useState(0)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null)

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)

  // Batch Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchActionLoading, setBatchActionLoading] = useState(false)
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null)

  // Auto-Fix state
  const [isAutoFixing, setIsAutoFixing] = useState(false)
  const [autoFixProgress, setAutoFixProgress] = useState<{ current: number; total: number } | null>(null)
  const [autoFixResult, setAutoFixResult] = useState<{
    totalScanned: number
    updatedCount: number
    unresolvableCount: number
  } | null>(null)

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
        q = q.or('model.is.null,model.eq.,model.eq.KOSONG,model.eq.Unknown,model.eq.—')
      } else if (filterModelStatus === 'filled') {
        q = q.not('model', 'is', null).neq('model', '').neq('model', 'KOSONG').neq('model', 'Unknown').neq('model', '—')
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
        q = q.or('model.is.null,model.eq.,model.eq.KOSONG,model.eq.Unknown,model.eq.—')
      } else if (filterModelStatus === 'filled') {
        q = q.not('model', 'is', null).neq('model', '').neq('model', 'KOSONG').neq('model', 'Unknown').neq('model', '—')
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

  // Run Auto-Fix All Models to Database
  const handleAutoFixModels = async () => {
    setIsAutoFixing(true)
    setAutoFixProgress({ current: 0, total: 0 })
    setAutoFixResult(null)

    try {
      const res = await batchSyncMissingModels(supabase, (cur, tot) => {
        setAutoFixProgress({ current: cur, total: tot })
      })

      setAutoFixResult(res)
      queryClient.invalidateQueries({ queryKey: ['units_page'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard_full_compliance_data'] })
      queryClient.invalidateQueries({ queryKey: ['units_count'] })
    } catch (err: any) {
      console.error('Error auto-fixing models:', err)
      setBatchFeedback(`Gagal menjalankan auto-fix: ${err.message}`)
      setTimeout(() => setBatchFeedback(null), 4000)
    } finally {
      setIsAutoFixing(false)
    }
  }

  // Batch Selection Toggles
  const toggleSelectAllPage = () => {
    if (selectedIds.size === units.length) {
      setSelectedIds(new Set())
    } else {
      const allIds = new Set(units.map((u) => u.id))
      setSelectedIds(allIds)
    }
  }

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  // Batch Update Status
  const handleBatchUpdateStatus = async (newStatus: string) => {
    if (selectedIds.size === 0) return
    setBatchActionLoading(true)

    try {
      const idsArray = Array.from(selectedIds)
      const { error } = await supabase.from('units').update({ status: newStatus }).in('id', idsArray)

      if (error) throw error

      setBatchFeedback(`${idsArray.length} unit berhasil diubah statusnya menjadi ${newStatus}!`)
      setTimeout(() => setBatchFeedback(null), 3000)
      setSelectedIds(new Set())

      queryClient.invalidateQueries({ queryKey: ['units_page'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard_full_compliance_data'] })
    } catch (err: any) {
      setBatchFeedback(`Gagal mengubah status: ${err.message}`)
      setTimeout(() => setBatchFeedback(null), 4000)
    } finally {
      setBatchActionLoading(false)
    }
  }

  // Batch Mark Milestone (Arrival / PDI) in unit_process
  const handleBatchUpdateProcess = async (field: 'arrival_check' | 'pdi_check', statusVal: 'DONE') => {
    if (selectedIds.size === 0) return
    setBatchActionLoading(true)

    try {
      const selectedUnits = units.filter((u) => selectedIds.has(u.id) && u.vin)
      const vins = selectedUnits.map((u) => u.vin as string)

      if (vins.length === 0) {
        setBatchFeedback('Tidak ada unit terpilih yang memiliki nomor VIN valid.')
        setTimeout(() => setBatchFeedback(null), 3000)
        return
      }

      // Upsert into unit_process for each vin
      const recordsToUpsert = vins.map((vin) => ({
        vin,
        [field]: statusVal,
      }))

      const { error } = await supabase.from('unit_process').upsert(recordsToUpsert, { onConflict: 'vin' })
      if (error) throw error

      const label = field === 'arrival_check' ? 'Arrival Check' : 'PDI Check'
      setBatchFeedback(`${vins.length} unit berhasil ditandai ${label}: ${statusVal}!`)
      setTimeout(() => setBatchFeedback(null), 3500)
      setSelectedIds(new Set())

      queryClient.invalidateQueries({ queryKey: ['units_page'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard_full_compliance_data'] })
      queryClient.invalidateQueries({ queryKey: ['process_page_data'] })
    } catch (err: any) {
      setBatchFeedback(`Gagal memperbarui proses massal: ${err.message}`)
      setTimeout(() => setBatchFeedback(null), 4000)
    } finally {
      setBatchActionLoading(false)
    }
  }

  // Batch Export
  const handleExport = (exportOnlySelected = false) => {
    const listToExport = exportOnlySelected
      ? units.filter((u) => selectedIds.has(u.id))
      : units

    const exportRows = listToExport.map((u) => {
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
      exportOnlySelected ? 'data-sdlg-unit-terpilih' : 'data-populasi-sdlg-unit',
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
            Database armada lengkap dengan sistem pelacakan otomatis model, VIN, cabang, dan kepatuhan
          </p>
        </div>

        {/* Action Buttons: Add Unit, Bulk Import, Auto-Fix, Export */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-primary px-3 py-2 text-xs flex items-center gap-1.5 font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Unit</span>
          </button>

          <button
            onClick={() => setIsBulkImportOpen(true)}
            className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
            title="Import Excel / CSV Massal"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => setIsAiModalOpen(true)}
            className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 font-semibold text-accent border-accent/35 bg-accent/10 hover:bg-accent/20"
            title="Update status/data unit via kalimat instruksi bahasa alami"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent animate-pulse" />
            <span>✨ AI Update Data</span>
          </button>

          <button
            onClick={handleAutoFixModels}
            disabled={isAutoFixing}
            className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 text-amber-400 hover:text-amber-300"
            title="Otomatis inferensi dan simpan model kosong ke DB"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAutoFixing ? 'animate-spin' : ''}`} />
            <span>{isAutoFixing ? 'Memperbaiki...' : '⚡ Auto-Fix Model ke DB'}</span>
          </button>

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
            onClick={() => handleExport(false)}
            disabled={units.length === 0}
            className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
            title="Download CSV Halaman Ini"
          >
            <Download className="w-3.5 h-3.5 text-accent" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Auto-Fix Progress / Summary Banner */}
      {isAutoFixing && autoFixProgress && (
        <div className="card p-4 border-amber-500/30 bg-amber-500/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-amber-300">Sedang Menganalisis & Menyimpan Model Unit ke Database...</p>
              <p className="text-surface-300 text-[11px]">
                Memproses {autoFixProgress.current} dari {autoFixProgress.total} unit dengan model kosong
              </p>
            </div>
          </div>
        </div>
      )}

      {autoFixResult && (
        <div className="card p-4 border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-emerald-300">Hasil Pembaruan Model Otomatis ke Database:</p>
              <p className="text-surface-200 text-[11px]">
                Dari {autoFixResult.totalScanned} unit diperiksa: <strong>{autoFixResult.updatedCount} unit</strong> berhasil diperbarui modelnya ke database. (Sisa {autoFixResult.unresolvableCount} unit perlu dilengkapi manual).
              </p>
            </div>
          </div>
          <button
            onClick={() => setAutoFixResult(null)}
            className="text-surface-400 hover:text-surface-200 text-xs px-2 py-1"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Batch Feedback Banner */}
      {batchFeedback && (
        <div className="p-3 bg-accent/20 border border-accent/40 rounded-xl text-accent text-xs flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{batchFeedback}</span>
        </div>
      )}

      {/* Batch Actions Bar (When items are selected) */}
      {selectedIds.size > 0 && (
        <div className="card p-3 bg-surface-900 border-accent/40 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-accent">{selectedIds.size} unit dipilih</span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-[11px] text-surface-400 hover:text-surface-200 underline ml-2"
            >
              Batalkan pilihan
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleBatchUpdateProcess('arrival_check', 'DONE')}
              disabled={batchActionLoading}
              className="btn-secondary text-[11px] px-2.5 py-1 text-blue-400 hover:bg-blue-400/10 border-blue-500/30"
              title="Tandai tahap arrival selesai untuk unit terpilih"
            >
              ✓ Set Arrival DONE
            </button>
            <button
              onClick={() => handleBatchUpdateProcess('pdi_check', 'DONE')}
              disabled={batchActionLoading}
              className="btn-secondary text-[11px] px-2.5 py-1 text-amber-400 hover:bg-amber-400/10 border-amber-500/30"
              title="Tandai tahap PDI selesai untuk unit terpilih"
            >
              ✓ Set PDI DONE
            </button>
            <button
              onClick={() => handleBatchUpdateStatus('aktif')}
              disabled={batchActionLoading}
              className="btn-secondary text-[11px] px-2.5 py-1 text-emerald-400"
            >
              Set Aktif
            </button>
            <button
              onClick={() => handleBatchUpdateStatus('idle')}
              disabled={batchActionLoading}
              className="btn-secondary text-[11px] px-2.5 py-1 text-surface-300"
            >
              Set Idle
            </button>
            <button
              onClick={() => handleExport(true)}
              className="btn-secondary text-[11px] px-2.5 py-1 flex items-center gap-1"
            >
              <Download className="w-3 h-3 text-accent" />
              <span>Export {selectedIds.size} Terpilih</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              type="text"
              placeholder="Cari berdasarkan No Unit, VIN, Model, Customer, atau Serial..."
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
              <option value="maintenance">Maintenance</option>
              <option value="transit">Transit</option>
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
              <option value="filled">Model Terisi di DB</option>
              <option value="missing">Model Kosong / Perlu Diisi</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="btn-secondary px-3 py-2 text-xs flex items-center gap-1 text-red-400 hover:text-red-300"
                title="Reset semua filter"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-surface-800 text-xs">
          <span className="text-surface-400 flex items-center gap-1 font-medium">
            <Filter className="w-3 h-3 text-accent" /> Filter Cepat:
          </span>
          <button
            onClick={() => {
              setFilterModelStatus('all')
              setPage(0)
            }}
            className={`px-2.5 py-1 rounded-full transition-colors ${
              filterModelStatus === 'all'
                ? 'bg-accent/20 text-accent font-semibold border border-accent/40'
                : 'bg-surface-800 text-surface-400 hover:text-surface-200'
            }`}
          >
            Semua ({totalCount})
          </button>
          <button
            onClick={() => {
              setFilterModelStatus('missing')
              setPage(0)
            }}
            className={`px-2.5 py-1 rounded-full transition-colors ${
              filterModelStatus === 'missing'
                ? 'bg-amber-400/20 text-amber-400 font-semibold border border-amber-400/40'
                : 'bg-surface-800 text-surface-400 hover:text-surface-200'
            }`}
          >
            Perlu Dilengkapi Model
          </button>
          <button
            onClick={() => {
              setFilterModelStatus('filled')
              setPage(0)
            }}
            className={`px-2.5 py-1 rounded-full transition-colors ${
              filterModelStatus === 'filled'
                ? 'bg-emerald-400/20 text-emerald-400 font-semibold border border-emerald-400/40'
                : 'bg-surface-800 text-surface-400 hover:text-surface-200'
            }`}
          >
            Model Lengkap
          </button>
        </div>
      </div>

      {/* Main Content: Table or Card View */}
      {isLoading ? (
        <TableSkeleton rows={10} cols={8} />
      ) : units.length === 0 ? (
        <div className="card text-center py-12 space-y-3">
          <Truck className="w-12 h-12 text-surface-600 mx-auto" />
          <h3 className="text-lg font-bold text-surface-200">Tidak ada unit ditemukan</h3>
          <p className="text-xs text-surface-400 max-w-sm mx-auto">
            Coba sesuaikan kata kunci pencarian atau bersihkan filter untuk melihat data lainnya.
          </p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="btn-secondary text-xs px-3 py-1.5 mx-auto">
              Reset Filter
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <div className="card overflow-hidden p-0 shadow-lg border border-surface-800">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-800 bg-surface-950/80 text-left text-surface-400">
                  <th className="px-3 py-3 w-10 text-center">
                    <button
                      onClick={toggleSelectAllPage}
                      className="text-surface-400 hover:text-surface-100"
                      title="Pilih semua baris halaman ini"
                    >
                      {selectedIds.size === units.length && units.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-accent" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold sticky left-0 bg-surface-950 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    No. Unit
                  </th>
                  <th className="px-3 py-3 font-semibold">Model Alat</th>
                  <th className="px-3 py-3 font-semibold">VIN / Rangka</th>
                  <th className="px-3 py-3 font-semibold">Cabang</th>
                  <th className="px-3 py-3 font-semibold">Customer</th>
                  <th className="px-3 py-3 font-semibold">Tahun/BL</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/40">
                {units.map((u) => {
                  const resolved = resolveUnitModel(u)
                  const isSelected = selectedIds.has(u.id)
                  const is2026 = u.year_delivery === 2026
                  const hasMissingDetails = !u.customer || !u.under_cabang || !u.model

                  return (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedUnit(u)}
                      className={`hover:bg-surface-800/40 cursor-pointer transition-colors group ${
                        isSelected ? 'bg-accent/5' : ''
                      }`}
                    >
                      <td
                        className="px-3 py-3 text-center"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSelectRow(u.id)
                        }}
                      >
                        <button className="text-surface-400 hover:text-surface-100">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-accent" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* No Unit */}
                      <td className="px-4 py-3 sticky left-0 bg-surface-900 group-hover:bg-surface-850 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                        <div className="font-bold text-surface-100 group-hover:text-accent transition-colors flex items-center gap-1.5">
                          {u.unit_number}
                          {hasMissingDetails && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-amber-400"
                              title="Data belum lengkap (perlu verifikasi)"
                            />
                          )}
                        </div>
                        <div className="text-[10px] text-surface-500 font-mono mt-0.5">
                          {u.serial_number || 'Tanpa S/N'}
                        </div>
                      </td>

                      {/* Model */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-semibold ${
                              u.model
                                ? 'text-surface-200'
                                : resolved.model !== 'Perlu Dilengkapi'
                                ? 'text-blue-400 font-medium'
                                : 'text-amber-400 italic'
                            }`}
                          >
                            {u.model || resolved.model}
                          </span>
                          {!u.model && resolved.isAutoInferred && resolved.model !== 'Perlu Dilengkapi' && (
                            <span
                              className="text-[9px] px-1 py-0.2 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 font-semibold"
                              title="Terdeteksi otomatis dari pola VIN/Unit"
                            >
                              Auto
                            </span>
                          )}
                        </div>
                      </td>

                      {/* VIN */}
                      <td className="px-3 py-3 font-mono text-surface-300">
                        {u.vin || <span className="text-surface-600">—</span>}
                      </td>

                      {/* Cabang */}
                      <td className="px-3 py-3 text-surface-300">
                        {u.under_cabang || <span className="text-surface-600">—</span>}
                      </td>

                      {/* Customer */}
                      <td className="px-3 py-3 text-surface-300">
                        <div className="truncate max-w-[140px]" title={u.customer || ''}>
                          {u.customer || <span className="text-surface-600">—</span>}
                        </div>
                      </td>

                      {/* Year */}
                      <td className="px-3 py-3">
                        {is2026 ? (
                          <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-red-400/15 text-red-400 border border-red-500/30">
                            2026 (CSA)
                          </span>
                        ) : (
                          <span className="text-surface-400 font-mono">{u.year_delivery || '—'}</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            u.status === 'aktif'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : u.status === 'idle'
                              ? 'bg-amber-400/15 text-amber-400 border border-amber-500/30'
                              : 'bg-surface-800 text-surface-400'
                          }`}
                        >
                          {u.status || 'N/A'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedUnit(u)
                          }}
                          className="p-1 rounded text-surface-400 hover:text-accent hover:bg-surface-800 transition-colors"
                          title="Buka Detail Unit 360°"
                        >
                          <Eye className="w-3.5 h-3.5" />
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
        /* Card Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.map((u) => {
            const resolved = resolveUnitModel(u)
            const is2026 = u.year_delivery === 2026

            return (
              <div
                key={u.id}
                onClick={() => setSelectedUnit(u)}
                className="card p-4 space-y-3 cursor-pointer hover:border-surface-700 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-surface-100 group-hover:text-accent transition-colors">
                      {u.unit_number}
                    </h4>
                    <p className="text-[11px] text-surface-500 font-mono">{u.vin || 'VIN: —'}</p>
                  </div>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      u.status === 'aktif'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : u.status === 'idle'
                        ? 'bg-amber-400/15 text-amber-400'
                        : 'bg-surface-800 text-surface-400'
                    }`}
                  >
                    {u.status}
                  </span>
                </div>

                <div className="pt-2 border-t border-surface-800/80 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-surface-500">Model:</span>
                    <span className="font-semibold text-surface-200">{u.model || resolved.model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500">Cabang:</span>
                    <span className="text-surface-300">{u.under_cabang || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500">Customer:</span>
                    <span className="text-surface-300 truncate max-w-[150px]">{u.customer || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-surface-500">Tahun/BL:</span>
                    {is2026 ? (
                      <span className="px-1.5 py-0.2 rounded font-bold text-[10px] bg-red-400/15 text-red-400">
                        2026 (Wajib CSA)
                      </span>
                    ) : (
                      <span className="text-surface-400 font-mono">{u.year_delivery || '—'}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs">
        <p className="text-surface-400">
          Menampilkan baris {filteredCount > 0 ? page * PAGE_SIZE + 1 : 0} -{' '}
          {Math.min((page + 1) * PAGE_SIZE, filteredCount)} dari {filteredCount.toLocaleString('id-ID')} unit
        </p>

        <div className="flex items-center gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Sebelumnya</span>
          </button>
          <span className="text-xs text-surface-300 px-2 font-mono">
            {page + 1} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40"
          >
            <span>Berikutnya</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modals & Drawers */}
      <UnitDetailDrawer unit={selectedUnit} onClose={() => setSelectedUnit(null)} />
      <CreateUnitModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['units_page'] })
        }}
      />
      <BulkImportModal isOpen={isBulkImportOpen} onClose={() => setIsBulkImportOpen(false)} />
      <AiUpdateModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        contextUnits={units}
        onUnitUpdated={(uNum) => {
          const found = units.find((u) => u.unit_number === uNum)
          if (found) setSelectedUnit(found)
        }}
      />
    </div>
  )
}
