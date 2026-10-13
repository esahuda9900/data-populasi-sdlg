import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Truck } from 'lucide-react'

export default function Units() {
  const { data: units = [], isLoading } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase.from('units').select('*').order('unit_number')
      if (error) throw error
      return data
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-surface-50">Unit</h2>
          <p className="text-sm text-surface-400 mt-1">{units.length} unit terdaftar</p>
        </div>
      </div>

      {units.length === 0 ? (
        <div className="card text-center py-12">
          <Truck className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-300 font-medium">Belum ada data unit</p>
          <p className="text-sm text-surface-500 mt-1">Data akan muncul setelah CSV di-upload.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-800 text-left text-surface-400">
                  <th className="px-5 py-3 font-medium">No Unit</th>
                  <th className="px-5 py-3 font-medium">Model</th>
                  <th className="px-5 py-3 font-medium">Serial</th>
                  <th className="px-5 py-3 font-medium">Tahun</th>
                  <th className="px-5 py-3 font-medium">Lokasi</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Operator</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit: any) => (
                  <tr key={unit.id} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                    <td className="px-5 py-3 font-medium text-surface-100">{unit.unit_number}</td>
                    <td className="px-5 py-3 text-surface-300">{unit.model || '—'}</td>
                    <td className="px-5 py-3 text-surface-300">{unit.serial_number || '—'}</td>
                    <td className="px-5 py-3 text-surface-300">{unit.year || '—'}</td>
                    <td className="px-5 py-3 text-surface-300">{unit.location || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        unit.status === 'aktif' ? 'bg-accent/15 text-accent' :
                        unit.status === 'idle' ? 'bg-amber-400/15 text-amber-400' :
                        unit.status === 'maintenance' ? 'bg-blue-400/15 text-blue-400' :
                        'bg-surface-700 text-surface-400'
                      }`}>
                        {unit.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-surface-300">{unit.operator || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}