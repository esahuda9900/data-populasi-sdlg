import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Search, Download, X, RefreshCw } from 'lucide-react'
import { TableSkeleton } from '../components/Skeleton'
import { exportToCSV } from '../lib/exportUtils'

const PAGE_SIZE = 30

export default function CommissioningPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [onlyComm, setOnlyComm] = useState(true)

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['page_wo_comm', search, page, onlyComm],
    staleTime: 20_000,
    queryFn: async () => {
      let q = supabase
        .from('work_orders')
        .select('*, units(unit_number, model, under_cabang, customer, vin)', { count: 'exact' })
        .order('start_date', { ascending: false, nullsFirst: false })

      if (onlyComm) {
        q = q.or(
          'description.ilike.%commis%,description.ilike.%commision%,description.ilike.%commission%,description.ilike.%commtest%,description.ilike.%comm %'
        )
      }
      if (search.trim()) {
        const s = search.trim()
        q = q.or(`vin.ilike.%${s}%,case_number.ilike.%${s}%,description.ilike.%${s}%,person_in_charge.ilike.%${s}%`)
      }
      const from = page * PAGE_SIZE
      const { data, error, count } = await q.range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      return { rows: data || [], total: count ?? 0 }
    },
  })

  const rows = data?.rows || []
  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-800 pb-3">
        <div>
          <h2 className="text-xl font-bold text-surface-50">Data Commissioning (WO AX)</h2>
          <p className="text-sm text-surface-400">
            Default: deskripsi mengandung commissioning / commision / commtest · PIC cabang
          </p>
        </div>
        <button type="button" onClick={() => refetch()} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input className="input pl-9 w-full text-sm" placeholder="VIN, case, deskripsi, PIC..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
            {search && <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}><X className="w-3.5 h-3.5" /></button>}
          </div>
          <label className="flex items-center gap-2 text-xs text-surface-300 cursor-pointer">
            <input type="checkbox" checked={onlyComm} onChange={(e) => { setOnlyComm(e.target.checked); setPage(0) }} className="rounded" />
            Hanya deskripsi commissioning
          </label>
        </div>
        <button type="button" className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
          onClick={() => exportToCSV('wo-commissioning', rows.map((r: any) => ({
            vin: r.vin, unit: r.units?.unit_number, case: r.case_number, desc: r.description,
            pic: r.person_in_charge, start: r.start_date, status: r.status, cabang: r.units?.under_cabang,
          })), [
            { key: 'vin', label: 'VIN' }, { key: 'unit', label: 'Unit' }, { key: 'case', label: 'Case' },
            { key: 'desc', label: 'Deskripsi' }, { key: 'pic', label: 'PIC WO' }, { key: 'start', label: 'Start' },
            { key: 'status', label: 'Status' }, { key: 'cabang', label: 'Cabang' },
          ])}>
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {isLoading ? <TableSkeleton rows={10} cols={6} /> : (
        <>
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800 text-xs text-surface-400 text-left">
                    <th className="px-3 py-3">VIN / Unit</th>
                    <th className="px-3 py-3">Case</th>
                    <th className="px-3 py-3">Deskripsi</th>
                    <th className="px-3 py-3">PIC WO</th>
                    <th className="px-3 py-3">Start</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Cabang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/40">
                  {rows.map((r: any) => (
                    <tr key={r.id} className="hover:bg-surface-800/30">
                      <td className="px-3 py-2.5">
                        <div className="font-mono text-[11px]">{r.vin || r.units?.vin || '—'}</div>
                        <div className="text-xs">{r.units?.unit_number || r.device_name || '—'}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono">{r.case_number || '—'}</td>
                      <td className="px-3 py-2.5 text-xs max-w-[220px]">{r.description || '—'}</td>
                      <td className="px-3 py-2.5 text-xs">{r.person_in_charge || '—'}</td>
                      <td className="px-3 py-2.5 text-xs font-mono">{r.start_date || '—'}</td>
                      <td className="px-3 py-2.5 text-xs">{r.status || '—'}</td>
                      <td className="px-3 py-2.5 text-xs">{r.units?.under_cabang || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-between text-xs text-surface-400">
            <span>{total.toLocaleString('id-ID')} WO</span>
            <div className="flex gap-2">
              <button type="button" disabled={page===0} onClick={() => setPage(p=>p-1)} className="btn-secondary px-3 py-1 disabled:opacity-40">Prev</button>
              <span className="font-mono">{page+1}/{pages}</span>
              <button type="button" disabled={page>=pages-1} onClick={() => setPage(p=>p+1)} className="btn-secondary px-3 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
