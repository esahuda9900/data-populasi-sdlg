import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { AlertCircle, CheckCircle2, Search, ClipboardList } from 'lucide-react'

export default function Process() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'missing_pdi' | 'missing_comm' | 'missing_arrival'>('all')

  const { data: units = [], isLoading } = useQuery({
    queryKey: ['units_process'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('id, vin, unit_number, model, customer, under_cabang, location, marketing_status, status')
        .order('unit_number')
      if (error) throw error
      return data || []
    },
  })

  // For now process data comes from units; later we join unit_process
  // Placeholder: we show units and mark that process tracking will be populated as data is imported
  const filtered = units.filter((u: any) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      (u.vin || '').toLowerCase().includes(q) ||
      (u.unit_number || '').toLowerCase().includes(q) ||
      (u.model || '').toLowerCase().includes(q) ||
      (u.customer || '').toLowerCase().includes(q)
    return matchSearch
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-surface-50">Process Tracking</h2>
          <p className="text-sm text-surface-400 mt-1">
            Tracking status ARRIVAL / MS / PDI / COMM per unit
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            type="text"
            placeholder="Cari VIN / Model / Customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 w-full sm:w-72"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'all', label: 'Semua', count: filtered.length },
          { key: 'missing_pdi', label: 'PDI Belum', count: '—' },
          { key: 'missing_comm', label: 'COMM Belum', count: '—' },
          { key: 'missing_arrival', label: 'Arrival Belum', count: '—' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`card text-left py-3 px-4 transition-colors ${
              filter === f.key ? 'border-accent/50 bg-accent/5' : 'hover:bg-surface-800/50'
            }`}
          >
            <p className="text-lg font-semibold text-surface-50">{f.count}</p>
            <p className="text-xs text-surface-400">{f.label}</p>
          </button>
        ))}
      </div>

      {units.length === 0 ? (
        <div className="card text-center py-12">
          <ClipboardList className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-300 font-medium">Data process sedang di-import</p>
          <p className="text-sm text-surface-500 mt-1">
            Setelah master unit + process check masuk, halaman ini akan menampilkan unit yang masih KOSONG.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-800 text-left text-surface-400">
                  <th className="px-4 py-3 font-medium">Unit / VIN</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Cabang</th>
                  <th className="px-4 py-3 font-medium">Arrival</th>
                  <th className="px-4 py-3 font-medium">PDI</th>
                  <th className="px-4 py-3 font-medium">COMM</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((unit: any) => (
                  <tr key={unit.id} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-surface-100">{unit.unit_number}</div>
                      <div className="text-xs text-surface-500 font-mono">{unit.vin}</div>
                    </td>
                    <td className="px-4 py-3 text-surface-300">{unit.model || '—'}</td>
                    <td className="px-4 py-3 text-surface-300 max-w-[160px] truncate">{unit.customer || '—'}</td>
                    <td className="px-4 py-3 text-surface-300">{unit.under_cabang || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-surface-500">
                        <AlertCircle className="w-3.5 h-3.5" /> Pending data
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-surface-500">
                        <AlertCircle className="w-3.5 h-3.5" /> Pending data
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-surface-500">
                        <AlertCircle className="w-3.5 h-3.5" /> Pending data
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card border-blue-500/20 bg-blue-500/5 text-sm text-surface-300">
        <p className="font-medium text-blue-400 mb-1">Catatan Expert</p>
        <p>
          Status process (ARRIVAL / MS / PDI / COMM) akan otomatis terisi seiring import data master.
          Setelah data process masuk, filter "PDI Belum", "COMM Belum", dll akan aktif dan menampilkan
          unit yang masih KOSONG / belum DONE.
        </p>
      </div>
    </div>
  )
}
