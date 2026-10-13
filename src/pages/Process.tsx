import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { AlertCircle, CheckCircle2, Search, ClipboardList, XCircle } from 'lucide-react'

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

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['units_with_process'],
    queryFn: async () => {
      const { data: units, error: e1 } = await supabase
        .from('units')
        .select('id, vin, unit_number, model, customer, under_cabang, location, marketing_status, status')
        .order('unit_number')
      if (e1) throw e1

      const { data: processes, error: e2 } = await supabase
        .from('unit_process')
        .select('vin, arrival_check, pdi_check, comm_check, ms_check_1, data_validity_check')
      if (e2) throw e2

      const procMap = new Map((processes || []).map((p: any) => [p.vin, p]))
      return (units || []).map((u: any) => ({
        ...u,
        process: procMap.get(u.vin) || null,
      }))
    },
  })

  const filtered = rows.filter((u: any) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      (u.vin || '').toLowerCase().includes(q) ||
      (u.unit_number || '').toLowerCase().includes(q) ||
      (u.model || '').toLowerCase().includes(q) ||
      (u.customer || '').toLowerCase().includes(q)

    if (!matchSearch) return false

    const p = u.process
    if (filter === 'missing_pdi') {
      return !p || !p.pdi_check || p.pdi_check === 'KOSONG'
    }
    if (filter === 'missing_comm') {
      return !p || !p.comm_check || p.comm_check === 'KOSONG'
    }
    if (filter === 'missing_arrival') {
      return !p || !p.arrival_check || p.arrival_check === 'KOSONG'
    }
    return true
  })

  const countMissingPdi = rows.filter((u: any) => !u.process || !u.process.pdi_check || u.process.pdi_check === 'KOSONG').length
  const countMissingComm = rows.filter((u: any) => !u.process || !u.process.comm_check || u.process.comm_check === 'KOSONG').length
  const countMissingArrival = rows.filter((u: any) => !u.process || !u.process.arrival_check || u.process.arrival_check === 'KOSONG').length

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
            Status ARRIVAL / PDI / COMM per unit
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
          { key: 'all', label: 'Semua', count: rows.length },
          { key: 'missing_pdi', label: 'PDI Belum', count: countMissingPdi },
          { key: 'missing_comm', label: 'COMM Belum', count: countMissingComm },
          { key: 'missing_arrival', label: 'Arrival Belum', count: countMissingArrival },
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

      {rows.length === 0 ? (
        <div className="card text-center py-12">
          <ClipboardList className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-300 font-medium">Belum ada data unit</p>
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
                      <StatusBadge value={unit.process?.arrival_check} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={unit.process?.pdi_check} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={unit.process?.comm_check} />
                    </td>
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
