import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, UnitDocument, Unit } from '../lib/supabase'
import {
  FileText,
  FileWarning,
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
  FileCheck,
} from 'lucide-react'
import { exportToCSV } from '../lib/exportUtils'
import { useDebounce } from '../lib/useDebounce'
import { resolveUnitModel } from '../lib/modelUtils'
import UnitDetailDrawer from '../components/UnitDetailDrawer'
import { TableSkeleton } from '../components/Skeleton'

const PAGE_SIZE = 50

export default function Documents() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [filterRequiredOnly, setFilterRequiredOnly] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'missing_pending' | 'all' | 'uploaded'>('missing_pending')
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null)

  // Total missing count
  const { data: totalMissing = 0 } = useQuery({
    queryKey: ['docs_missing_count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('unit_documents')
        .select('*', { count: 'exact', head: true })
        .in('status', ['missing', 'pending'])
      return count ?? 0
    },
  })

  // Total uploaded count
  const { data: totalUploaded = 0 } = useQuery({
    queryKey: ['docs_uploaded_count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('unit_documents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'uploaded')
      return count ?? 0
    },
  })

  // Paginated and filtered documents
  const { data: queryResult, isLoading } = useQuery<{ rows: UnitDocument[]; total: number }>({
    queryKey: ['docs_page_data', page, debouncedSearch, filterRequiredOnly, filterStatus],
    queryFn: async () => {
      let q = supabase
        .from('unit_documents')
        .select(`
          id,
          unit_id,
          document_type_id,
          status,
          file_name,
          file_url,
          uploaded_at,
          notes,
          document_types (id, code, name, description, is_required, sort_order),
          units (id, unit_number, model, vin, customer, under_cabang, location, status, serial_number, year_delivery, marketing_status, stock_status, group_type, variant, device_number, customer_update, created_at, updated_at)
        `)

      // Status filter
      if (filterStatus === 'missing_pending') {
        q = q.in('status', ['missing', 'pending'])
      } else if (filterStatus === 'uploaded') {
        q = q.eq('status', 'uploaded')
      }

      // If user is searching by unit or VIN, resolve matching units first for accurate server search
      if (debouncedSearch.trim()) {
        const s = debouncedSearch.trim()
        const { data: matchingUnits } = await supabase
          .from('units')
          .select('id')
          .or(`vin.ilike.%${s}%,unit_number.ilike.%${s}%,model.ilike.%${s}%,customer.ilike.%${s}%`)
          .limit(1000)

        const matchingUnitIds = (matchingUnits || []).map((u: { id: string }) => u.id)

        if (matchingUnitIds.length > 0) {
          q = q.in('unit_id', matchingUnitIds)
        } else {
          // If no unit matched, query document file_name
          q = q.ilike('file_name', `%${s}%`)
        }
      }

      const { count: exactTotal } = await q.select('*', { count: 'exact', head: true })

      const { data, error } = await q
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (error) throw error

      let result = (data as unknown as UnitDocument[]) || []
      if (filterRequiredOnly) {
        result = result.filter((d) => d.document_types?.is_required)
      }

      return {
        rows: result,
        total: exactTotal ?? result.length,
      }
    },
  })

  const docs = queryResult?.rows || []
  const totalItems = queryResult?.total ?? totalMissing
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))

  const handleExport = () => {
    const exportData = docs.map((d) => ({
      unit_number: d.units?.unit_number || '—',
      vin: d.units?.vin || '—',
      model: resolveUnitModel(d.units).model,
      customer: d.units?.customer || '—',
      cabang: d.units?.under_cabang || '—',
      doc_name: d.document_types?.name || '—',
      is_required: d.document_types?.is_required ? 'Ya (Wajib)' : 'Tidak',
      status: d.status,
      file_name: d.file_name || 'Belum diunggah',
    }))

    exportToCSV('tracking-dokumen-sdlg', exportData, [
      { key: 'unit_number', label: 'No Unit' },
      { key: 'vin', label: 'VIN' },
      { key: 'model', label: 'Model' },
      { key: 'customer', label: 'Customer' },
      { key: 'cabang', label: 'Cabang' },
      { key: 'doc_name', label: 'Jenis Dokumen' },
      { key: 'is_required', label: 'Wajib' },
      { key: 'status', label: 'Status' },
      { key: 'file_name', label: 'File' },
    ])
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-surface-50">Pelacakan Berkas & Dokumen</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-800 text-surface-300 border border-surface-700">
              {totalItems.toLocaleString('id-ID')} Dokumen
            </span>
          </div>
          <p className="text-sm text-surface-400 mt-1">
            Monitoring kelengkapan dokumen serah terima, BAST, garansi, dan faktur unit SDLG
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExport}
            disabled={docs.length === 0}
            className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5 text-accent" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
            <FileWarning className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-surface-400">Dokumen Missing / Belum Lengkap</p>
            <p className="text-2xl font-bold text-amber-400 mt-0.5">
              {totalMissing.toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        <div className="card p-4 border-accent/20 bg-accent/5 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-accent/10 text-accent">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-surface-400">Dokumen Sudah Diunggah</p>
            <p className="text-2xl font-bold text-accent mt-0.5">
              {totalUploaded.toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-surface-400">Persentase Kepatuhan</p>
            <p className="text-2xl font-bold text-surface-100 mt-0.5">
              {totalMissing + totalUploaded > 0
                ? `${Math.round((totalUploaded / (totalMissing + totalUploaded)) * 100)}%`
                : '100%'}
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filter Panel */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              type="text"
              placeholder="Cari Unit, VIN, Model, atau Customer..."
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

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value as any)
                setPage(0)
              }}
              className="input text-sm w-full sm:w-44"
            >
              <option value="missing_pending">Fokus: Missing / Pending</option>
              <option value="uploaded">Sudah Uploaded Saja</option>
              <option value="all">Semua Status Dokumen</option>
            </select>

            <button
              onClick={() => setFilterRequiredOnly(!filterRequiredOnly)}
              className={`btn px-3 py-2 text-xs border rounded-lg transition-colors ${
                filterRequiredOnly
                  ? 'bg-red-400/15 border-red-500/30 text-red-400 font-semibold'
                  : 'bg-surface-800 border-surface-700 text-surface-400 hover:text-surface-200'
              }`}
            >
              {filterRequiredOnly ? '✓ Hanya Dokumen Wajib' : 'Tampilkan Semua Jenis'}
            </button>
          </div>
        </div>
      </div>

      {/* Table Content */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : docs.length === 0 ? (
        <div className="card text-center py-16 space-y-3">
          <FileText className="w-12 h-12 text-surface-600 mx-auto" />
          <h3 className="text-base font-semibold text-surface-200">Tidak ada dokumen ditemukan</h3>
          <p className="text-xs text-surface-400 max-w-sm mx-auto">
            Semua dokumen pada kriteria ini telah lengkap atau tidak sesuai kata kunci pencarian.
          </p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0 shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800 bg-surface-950/60 text-left text-surface-400">
                    <th className="px-5 py-3 font-semibold sticky left-0 bg-surface-950 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                      No Unit & Model
                    </th>
                    <th className="px-5 py-3 font-semibold">Customer / Cabang</th>
                    <th className="px-5 py-3 font-semibold">Jenis Dokumen</th>
                    <th className="px-5 py-3 font-semibold">Status Berkas</th>
                    <th className="px-5 py-3 font-semibold">Kategori</th>
                    <th className="px-5 py-3 font-semibold text-right">Detail Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/40">
                  {docs.map((doc) => {
                    const isMissing = doc.status === 'missing' || doc.status === 'pending'
                    return (
                      <tr
                        key={doc.id}
                        onClick={() => doc.units && setSelectedUnit(doc.units)}
                        className="hover:bg-surface-800/40 cursor-pointer transition-colors group"
                      >
                        <td className="px-5 py-3 sticky left-0 bg-surface-900 group-hover:bg-surface-850 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                          <div className="font-semibold text-surface-100 group-hover:text-accent transition-colors">
                            {doc.units?.unit_number || '—'}
                          </div>
                          <div className="text-xs text-surface-400">
                            <span className="font-semibold text-surface-200">
                              {resolveUnitModel(doc.units).model}
                            </span>{' '}
                            • <span className="font-mono">{doc.units?.vin || ''}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-surface-300">
                          <div className="font-medium truncate max-w-[170px]" title={doc.units?.customer || ''}>
                            {doc.units?.customer || '—'}
                          </div>
                          <div className="text-xs text-surface-500">{doc.units?.under_cabang || '—'}</div>
                        </td>
                        <td className="px-5 py-3 text-surface-200 font-medium">
                          {doc.document_types?.name || 'Dokumen'}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                              isMissing
                                ? 'bg-red-400/15 text-red-400 border border-red-500/20'
                                : 'bg-accent/15 text-accent border border-accent/20'
                            }`}
                          >
                            {isMissing ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {doc.document_types?.is_required ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-500/20">
                              Wajib
                            </span>
                          ) : (
                            <span className="text-xs text-surface-500">Opsional</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (doc.units) setSelectedUnit(doc.units)
                            }}
                            className="p-1.5 rounded-lg text-surface-400 hover:text-accent hover:bg-surface-800 transition-colors"
                            title="Buka Unit 360°"
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

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <p className="text-xs text-surface-400">
              Menampilkan {docs.length > 0 ? page * PAGE_SIZE + 1 : 0} -{' '}
              {Math.min((page + 1) * PAGE_SIZE, totalItems)} dari {totalItems.toLocaleString('id-ID')} berkas
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
