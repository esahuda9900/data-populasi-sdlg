import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { FileText, FileWarning } from 'lucide-react'

export default function Documents() {
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['unit_documents_full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unit_documents')
        .select(`
          *,
          document_types (name, code, is_required),
          units (unit_number, model)
        `)
        .order('status')
      if (error) throw error
      return data
    },
  })

  const missing = docs.filter((d: any) => d.status === 'missing' || d.status === 'pending')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-surface-50">Tracking Dokumen</h2>
        <p className="text-sm text-surface-400 mt-1">
          Fokus: dokumen yang belum di-upload
        </p>
      </div>

      {docs.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-300 font-medium">Belum ada data dokumen</p>
          <p className="text-sm text-surface-500 mt-1">
            Setelah unit masuk, sistem akan generate status dokumen otomatis.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-amber-400">
            <FileWarning className="w-4 h-4" />
            <span>{missing.length} dokumen belum lengkap</span>
          </div>

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
                    <th className="px-5 py-3 font-medium">Catatan</th>
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
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          doc.status === 'uploaded' ? 'bg-accent/15 text-accent' :
                          doc.status === 'missing' ? 'bg-red-400/15 text-red-400' :
                          doc.status === 'pending' ? 'bg-amber-400/15 text-amber-400' :
                          doc.status === 'expired' ? 'bg-orange-400/15 text-orange-400' :
                          'bg-surface-700 text-surface-400'
                        }`}>
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
                      <td className="px-5 py-3 text-surface-400">{doc.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}