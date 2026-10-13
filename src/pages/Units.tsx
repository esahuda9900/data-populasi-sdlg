import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Truck, Search } from 'lucide-react'

export default function Units() {
  const [search, setSearch] = useState('')
  const [filterCabang, setFilterCabang] = useState('')

  const { data: units = [], isLoading } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase.from('units').select('*').order('unit_number')
      if (error) throw error
      return data || []
    },
  })

  const cabangs = Array.from(new Set(units.map((u: any) => u.under_cabang).filter(Boolean))).sort()

  const filtered = units.filter((u: any) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      (u.vin || '').toLowerCase().includes(q) ||
      (u.unit_number || '').toLowerCase().includes(q) ||
      (u.model || '').toLowerCase().includes(q) ||
      (u.serial_number || '').toLowerCase().includes(q) ||
      (u.customer || '').toLowerCase().includes(q)
    const matchCabang = !filterCabang || u.under_cabang === filterCabang
    return matchSearch && matchCabang
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
          <h2 className="text-xl font-semibold text-surface-50">Unit</h2>
          <p className="text-sm text-surface-400 mt-1">
            {filtered.length} dari {units.length} unit
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              type="text"
              placeholder="Cari VIN / Model / Customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 w-full sm:w-64"
            />
          </div>
          <select
            value={filterCabang}
            onChange={(e) => setFilterCabang(e.target.value)}
            className="input w-full sm:w-40"
          >
            <option value="">Semua Cabang</option>
            {cabangs.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {units.length === 0 ? (
        <div className="card text-center py-12">
          <Truck className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-300 font-medium">Data unit sedang di-import</p>
          <p className="text-sm text-surface-500 mt-1">Refresh halaman setelah beberapa saat.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-800 text-left text-surface-400">
                  <th className="px-4 py-3 font-medium">VIN / Unit</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Cabang</th>
                  <th className="px-4 py-3 font-medium">Lokasi</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Marketing</th>
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
                    <td className="px-4 py-3 text-surface-300 max-w-[180px] truncate">{unit.customer || '—'}</td>
                    <td className="px-4 py-3 text-surface-300">{unit.under_cabang || '—'}</td>
                    <td className="px-4 py-3 text-surface-400 max-w-[160px] truncate">{unit.location || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        unit.status === 'aktif' ? 'bg-accent/15 text-accent' :
                        unit.status === 'idle' ? 'bg-amber-400/15 text-amber-400' :
                        'bg-surface-700 text-surface-400'
                      }`}>
                        {unit.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-surface-300">{unit.marketing_status || '—'}</td>
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
