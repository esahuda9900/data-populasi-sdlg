import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Search, Download, X, RefreshCw } from 'lucide-react'
import { TableSkeleton } from '../components/Skeleton'
import { exportToCSV } from '../lib/exportUtils'

const PAGE_SIZE = 30

export default function DeparturesPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['page_sju', search, page],
    staleTime: 20_000,
    queryFn: async () => {
      let q = supabase
        .from('unit_deliveries')
        .select('*, units(unit_number, model, under_cabang, customer, vin)', { count: 'exact' })
        .order('berangkat_date', { ascending: false, nullsFirst: false })

      if (search.trim()) {
        const s = search.trim()
        q = q.or(`vin.ilike.%${s}%,delivery_point.ilike.%${s}%,customer_cabang.ilike.%${s}%,cabang.ilike.%${s}%,forwarder.ilike.%${s}%`)
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
          <h2 className="text-xl font-bold text-surface-50">Data Keberangkatan (SJU)</h2>
          <p className="text-sm text-surface-400">
            Cek tujuan: ke customer vs cabang/LDP · tanpa penjualan = rekonsiliasi
          </p>
        </div>
        <button type="button" onClick={() => refetch()} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input className="input pl-9 w-full text-sm" placeholder="VIN, tujuan, cabang, forwarder..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
          {search && <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}><X className="w-3.5 h-3.5" /></button>}
        </div>
        <button type="button" className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
          onClick={() => exportToCSV('sju', rows.map((r: any) => ({
            vin: r.vin, unit: r.units?.unit_number, berangkat: r.berangkat_date, sampai: r.sampai_date,
            from: r.pick_up_point, to: r.delivery_point, cabang: r.cabang, forwarder: r.forwarder,
          })), [
            { key: 'vin', label: 'VIN' }, { key: 'unit', label: 'Unit' }, { key: 'berangkat', label: 'Berangkat' },
            { key: 'sampai', label: 'Sampai' }, { key: 'from', label: 'Asal' }, { key: 'to', label: 'Tujuan' },
            { key: 'cabang', label: 'Cabang' }, { key: 'forwarder', label: 'Forwarder' },
          ])}>
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {isLoading ? <TableSkeleton rows={10} cols={7} /> : (
        <>
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800 text-xs text-surface-400 text-left">
                    <th className="px-3 py-3">VIN / Unit</th>
                    <th className="px-3 py-3">Berangkat</th>
                    <th className="px-3 py-3">Sampai</th>
                    <th className="px-3 py-3">Asal</th>
                    <th className="px-3 py-3">Tujuan</th>
                    <th className="px-3 py-3">Cabang</th>
                    <th className="px-3 py-3">Forwarder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/40">
                  {rows.map((r: any) => (
                    <tr key={r.id} className="hover:bg-surface-800/30">
                      <td className="px-3 py-2.5">
                        <div className="font-mono text-[11px]">{r.vin || '—'}</div>
                        <div className="text-xs">{r.units?.unit_number || r.tipe_unit || '—'}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono">{r.berangkat_date || '—'}</td>
                      <td className="px-3 py-2.5 text-xs font-mono">{r.sampai_date || '—'}</td>
                      <td className="px-3 py-2.5 text-xs max-w-[120px] truncate">{r.pick_up_point || '—'}</td>
                      <td className="px-3 py-2.5 text-xs max-w-[140px] truncate">{r.delivery_point || r.customer_cabang || '—'}</td>
                      <td className="px-3 py-2.5 text-xs">{r.cabang || r.units?.under_cabang || '—'}</td>
                      <td className="px-3 py-2.5 text-xs">{r.forwarder || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-between text-xs text-surface-400">
            <span>{total.toLocaleString('id-ID')} baris SJU</span>
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
