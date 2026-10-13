import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { AlertCircle, CheckCircle2, Search, ClipboardList, XCircle, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 50

function StatusBadge({ value }: { value: string | null }) {
  if (!value || value === '' || value === 'KOSONG') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-400/15 text-red-400">
        <XCircle className="w-3.5 h-3.5" /> KOSONG
      </span>
    )
  }
  if (value === 'DONE') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-accent/15 text-accent">
        <CheckCircle2 className="w-3.5 h-3.5" /> DONE
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-400/15 text-amber-400">
      <AlertCircle className="w-3.5 h-3.5" /> {value}
    </span>
  )
}

export default function Process() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'missing_pdi' | 'missing_comm' | 'missing_arrival'>('all')
  const [page, setPage] = useState(0)

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

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['process_page', page, search, filter],
    queryFn: async () => {
      // Join via units + process
      let unitQ = supabase
        .from('units')
        .select('id, vin, unit_number, model, customer, under_cabang')
        .order('unit_number')
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (search.trim()) {
        const s = search.trim()
        unitQ = unitQ.or(`vin.ilike.%${s}%,unit_number.ilike.%${s}%,model.ilike.%${s}%,customer.ilike.%${s}%`)
      }

      const { data: units, error } = await unitQ
      if (error) throw error

      const vins = (units || []).map((u: any) => u.vin).filter(Boolean)
      if (vins.length === 0) return []

      const { data: processes } = await supabase
        .from('unit_process')
        .select('vin, arrival_check, pdi_check, comm_check')
        .in('vin', vins)

      const procMap = new Map((processes || []).map((p: any) => [p.vin, p]))

      let result = (units || []).map((u: any) => ({
        ...u,
        process: procMap.get(u.vin) || null,
      }))

      if (filter === 'missing_pdi') {
        result = result.filter((u: any) => !u.process?.pdi_check || u.process.pdi_check === 'KOSONG')
      } else if (filter === 'missing_comm') {
        result = result.filter((u: any) => !u.process?.comm_check || u.process.comm_check === 'KOSONG')
      } else if (filter === 'missing_arrival') {
        result = result.filter((u: any) => !u.process?.arrival_check || u.process.arrival_check === 'KOSONG')
      }

      return result
    },
  })

  const totalPages = Math.max(1, Math.ceil((summary?.total || 1) / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-surface-50">Process Tracking</h2>
          <p className="text-sm text-surface-400 mt-1">Status ARRIVAL / PDI / COMM per unit</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            type="text"
            placeholder="Cari VIN / Model / Customer..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="input pl-9 w-full sm:w-72"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'all', label: 'Semua', count: summary?.total ?? '—' },
          { key: 'missing_pdi', label: 'PDI Belum', count: summary?.pdi ?? '—' },
          { key: 'missing_comm', label: 'COMM Belum', count: summary?.comm ?? '—' },
          { key: 'missing_arrival', label: 'Arrival Belum', count: summary?.arrival ?? '—' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key as any); setPage(0) }}
            className={`card text-left py-3 px-4 transition-colors ${
              filter === f.key ? 'border-accent/50 bg-accent/5' : 'hover:bg-surface-800/50'
            }`}
          >
            <p className="text-lg font-semibold text-surface-50">
              {typeof f.count === 'number' ? f.count.toLocaleString('id-ID') : f.count}
            </p>
            <p className="text-xs text-surface-400">{f.label}</p>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
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
                  {rows.map((unit: any) => (
                    <tr key={unit.id} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                      <td className="px-4 py-3">
                        <div className="font-medium text-surface-100">{unit.unit_number}</div>
                        <div className="text-xs text-surface-500 font-mono">{unit.vin}</div>
                      </td>
                      <td className="px-4 py-3 text-surface-300">{unit.model || '—'}</td>
                      <td className="px-4 py-3 text-surface-300 max-w-[160px] truncate">{unit.customer || '—'}</td>
                      <td className="px-4 py-3 text-surface-300">{unit.under_cabang || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge value={unit.process?.arrival_check} /></td>
                      <td className="px-4 py-3"><StatusBadge value={unit.process?.pdi_check} /></td>
                      <td className="px-4 py-3"><StatusBadge value={unit.process?.comm_check} /></td>
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
