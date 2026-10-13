import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Truck, Search, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 50

export default function Units() {
  const [search, setSearch] = useState('')
  const [filterCabang, setFilterCabang] = useState('')
  const [page, setPage] = useState(0)

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
      const { data } = await supabase.from('units').select('under_cabang').limit(10000)
      const set = new Set((data || []).map((u: any) => u.under_cabang).filter(Boolean))
      return Array.from(set).sort() as string[]
    },
  })

  const { data: units = [], isLoading } = useQuery({
    queryKey: ['units_page', page, search, filterCabang],
    queryFn: async () => {
      let q = supabase
        .from('units')
        .select('*')
        .order('unit_number')
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (filterCabang) {
        q = q.eq('under_cabang', filterCabang)
      }
      if (search.trim()) {
        const s = search.trim()
        q = q.or(`vin.ilike.%${s}%,unit_number.ilike.%${s}%,model.ilike.%${s}%,serial_number.ilike.%${s}%,customer.ilike.%${s}%`)
      }

      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  const { data: filteredCount = 0 } = useQuery({
    queryKey: ['units_filtered_count', search, filterCabang],
    queryFn: async () => {
      let q = supabase.from('units').select('*', { count: 'exact', head: true })
      if (filterCabang) q = q.eq('under_cabang', filterCabang)
      if (search.trim()) {
        const s = search.trim()
        q = q.or(`vin.ilike.%${s}%,unit_number.ilike.%${s}%,model.ilike.%${s}%,serial_number.ilike.%${s}%,customer.ilike.%${s}%`)
      }
      const { count } = await q
      return count ?? 0
    },
  })

  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-surface-50">Unit</h2>
          <p className="text-sm text-surface-400 mt-1">
            {filteredCount.toLocaleString('id-ID')} dari {totalCount.toLocaleString('id-ID')} unit
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              type="text"
              placeholder="Cari VIN / Model / Customer..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              className="input pl-9 w-full sm:w-64"
            />
          </div>
          <select
            value={filterCabang}
            onChange={(e) => { setFilterCabang(e.target.value); setPage(0) }}
            className="input w-full sm:w-40"
          >
            <option value="">Semua Cabang</option>
            {cabangs.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : units.length === 0 ? (
        <div className="card text-center py-12">
          <Truck className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-300 font-medium">Tidak ada unit</p>
        </div>
      ) : (
        <>
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
                  {units.map((unit: any) => (
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

          <div className="flex items-center justify-between">
            <p className="text-sm text-surface-400">
              Halaman {page + 1} / {totalPages}
            </p>
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
