import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { FileText, FileWarning, ChevronLeft, ChevronRight, Search } from 'lucide-react'

const PAGE_SIZE = 50

export default function Documents() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')

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

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['docs_page', page, search],
    queryFn: async () => {
      let q = supabase
        .from('unit_documents')
        .select(`
          *,
          document_types (name, code, is_required),
          units (unit_number, model, vin, customer)
        `)
        .in('status', ['missing', 'pending'])
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      const { data, error } = await q
      if (error) throw error

      let result = data || []
      if (search.trim()) {
        const s = search.toLowerCase()
        result = result.filter(
          (d: any) =>
            (d.units?.unit_number || '').toLowerCase().includes(s) ||
            (d.units?.model || '').toLowerCase().includes(s) ||
            (d.units?.vin || '').toLowerCase().includes(s) ||
            (d.document_types?.name || '').toLowerCase().includes(s)
        )
      }
      return result
    },
  })

  const totalPages = Math.max(1, Math.ceil(totalMissing / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-surface-50">Tracking Dokumen</h2>
          <p className="text-sm text-surface-400 mt-1">Fokus: dokumen yang belum di-upload</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            type="text"
            placeholder="Filter di halaman ini..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 w-full sm:w-64"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-amber-400">
        <FileWarning className="w-4 h-4" />
        <span>{totalMissing.toLocaleString('id-ID')} dokumen belum lengkap</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-300 font-medium">Tidak ada dokumen missing</p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800 text-left text-surface-400">
                    <th className="px-5 py-3 font-medium">No Unit</th>
                    <th className="px-5 py-3 font-medium">Model</th>
                    <th className="px-5 py-3 font-medium">Jenis Dokumen</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Wajib?</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc: any) => (
                    <tr key={doc.id} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                      <td className="px-5 py-3 font-medium text-surface-100">
                        {doc.units?.unit_number || '—'}
                      </td>
                      <td className="px-5 py-3 text-surface-300">{doc.units?.model || '—'}</td>
                      <td className="px-5 py-3 text-surface-300">{doc.document_types?.name || '—'}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-400/15 text-red-400">
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-surface-300">
                        {doc.document_types?.is_required ? (
                          <span className="text-red-400">Ya</span>
                        ) : (
                          <span className="text-surface-500">Tidak</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-surface-400">Halaman {page + 1} / {totalPages}</p>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="btn-secondary flex items-center gap-1 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary flex items-center gap-1 disabled:opacity-40"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
