import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  Search,
  X,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Package,
  FileText,
  ShoppingCart,
  Ship,
  Wrench,
  Database,
  ClipboardList,
  Users,
} from 'lucide-react'
import { TableSkeleton, Skeleton } from '../components/Skeleton'
import { useDebounce } from '../lib/useDebounce'

const PAGE_SIZE = 20

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
        on
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
          : 'bg-surface-800/60 text-surface-500 border-surface-700'
      }`}
    >
      {on ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </span>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-surface-800/50 text-xs">
      <span className="text-surface-500 shrink-0">{k}</span>
      <span className="text-surface-200 text-right break-all">{v ?? '—'}</span>
    </div>
  )
}

export default function MasterUnitPage() {
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 300)
  const [page, setPage] = useState(0)
  const [selectedVin, setSelectedVin] = useState<string | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)

  const { data: listData, isLoading: listLoading, refetch, isRefetching } = useQuery({
    queryKey: ['v_unit_master_list', debounced, page],
    staleTime: 15_000,
    queryFn: async () => {
      let q = supabase
        .from('v_unit_master')
        .select('*', { count: 'exact' })
        .order('unit_number', { ascending: true })

      if (debounced.trim()) {
        const s = debounced.trim()
        q = q.or(
          `vin.ilike.%${s}%,unit_number.ilike.%${s}%,serial_number.ilike.%${s}%,model.ilike.%${s}%,customer.ilike.%${s}%,under_cabang.ilike.%${s}%,device_number.ilike.%${s}%`
        )
      }

      const from = page * PAGE_SIZE
      const { data, error, count } = await q.range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      return { rows: data || [], total: count ?? 0 }
    },
  })

  const rows = listData?.rows || []
  const total = listData?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Detail: parallel queries when a unit is selected
  const detailEnabled = !!selectedUnitId || !!selectedVin

  const { data: master, isLoading: masterLoading } = useQuery({
    queryKey: ['v_unit_master_one', selectedUnitId, selectedVin],
    enabled: detailEnabled,
    queryFn: async () => {
      let q = supabase.from('v_unit_master').select('*').limit(1)
      if (selectedUnitId) q = q.eq('unit_id', selectedUnitId)
      else if (selectedVin) q = q.eq('vin', selectedVin)
      const { data, error } = await q.maybeSingle()
      if (error) throw error
      return data
    },
  })

  const { data: sales = [] } = useQuery({
    queryKey: ['master_sales', selectedUnitId, selectedVin],
    enabled: detailEnabled,
    queryFn: async () => {
      let q = supabase.from('unit_sales').select('*')
      if (selectedUnitId && selectedVin) {
        q = q.or(`unit_id.eq.${selectedUnitId},vin.eq.${selectedVin}`)
      } else if (selectedUnitId) q = q.eq('unit_id', selectedUnitId)
      else q = q.eq('vin', selectedVin!)
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  const { data: sju = [] } = useQuery({
    queryKey: ['master_sju', selectedUnitId, selectedVin],
    enabled: detailEnabled,
    queryFn: async () => {
      let q = supabase.from('unit_deliveries').select('*')
      if (selectedUnitId && selectedVin) {
        q = q.or(`unit_id.eq.${selectedUnitId},vin.eq.${selectedVin}`)
      } else if (selectedUnitId) q = q.eq('unit_id', selectedUnitId)
      else q = q.eq('vin', selectedVin!)
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  const { data: wos = [] } = useQuery({
    queryKey: ['master_wo', selectedUnitId, selectedVin],
    enabled: detailEnabled,
    queryFn: async () => {
      let q = supabase.from('work_orders').select('*').order('start_date', { ascending: false })
      if (selectedUnitId && selectedVin) {
        q = q.or(`unit_id.eq.${selectedUnitId},vin.eq.${selectedVin}`)
      } else if (selectedUnitId) q = q.eq('unit_id', selectedUnitId)
      else q = q.eq('vin', selectedVin!)
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  const { data: crm = [] } = useQuery({
    queryKey: ['master_crm', selectedUnitId, selectedVin],
    enabled: detailEnabled,
    queryFn: async () => {
      let q = supabase.from('crm_records').select('*')
      if (selectedUnitId && selectedVin) {
        q = q.or(`unit_id.eq.${selectedUnitId},vin.eq.${selectedVin}`)
      } else if (selectedUnitId) q = q.eq('unit_id', selectedUnitId)
      else q = q.eq('vin', selectedVin!)
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  const { data: docs = [] } = useQuery({
    queryKey: ['master_docs', selectedUnitId],
    enabled: !!selectedUnitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unit_documents')
        .select('status, file_name, uploaded_at, document_types(code, name)')
        .eq('unit_id', selectedUnitId!)
      if (error) throw error
      return data || []
    },
  })

  const openUnit = (r: any) => {
    setSelectedUnitId(r.unit_id)
    setSelectedVin(r.vin || null)
  }

  const closeDetail = () => {
    setSelectedUnitId(null)
    setSelectedVin(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-800 pb-3">
        <div>
          <h2 className="text-xl font-bold text-surface-50">Master Data Unit</h2>
          <p className="text-sm text-surface-400">
            Cari VIN / unit → semua sumber data yang terhubung (OLDP, jual, SJU, WO, CRM, proses, dokumen)
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="relative w-full sm:max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
        <input
          className="input pl-9 w-full text-sm font-mono"
          placeholder="Contoh: VLGE621FEN0609585 / E6210F / 609585 / BANJARMASIN..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
        />
        {search && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2"
            onClick={() => setSearch('')}
          >
            <X className="w-3.5 h-3.5 text-surface-400" />
          </button>
        )}
      </div>

      <div className={`grid gap-5 ${selectedUnitId || selectedVin ? 'lg:grid-cols-5' : ''}`}>
        <div className={selectedUnitId || selectedVin ? 'lg:col-span-2' : ''}>
          {listLoading ? (
            <TableSkeleton rows={8} cols={4} />
          ) : (
            <>
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto max-h-[70vh]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface-950 z-10">
                      <tr className="border-b border-surface-800 text-xs text-surface-400 text-left">
                        <th className="px-3 py-3">VIN / Unit</th>
                        <th className="px-3 py-3">Model</th>
                        <th className="px-3 py-3">Cabang</th>
                        <th className="px-3 py-3">Sumber</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-800/40">
                      {rows.map((r: any) => {
                        const active = r.unit_id === selectedUnitId
                        return (
                          <tr
                            key={r.unit_id}
                            onClick={() => openUnit(r)}
                            className={`cursor-pointer transition-colors ${
                              active ? 'bg-accent/10' : 'hover:bg-surface-800/40'
                            }`}
                          >
                            <td className="px-3 py-2.5">
                              <div className="font-mono text-[11px] text-accent">{r.vin || '—'}</div>
                              <div className="text-xs text-surface-200">{r.unit_number || '—'}</div>
                              <div className="text-[10px] text-surface-500 truncate max-w-[140px]">
                                {r.customer || '—'}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-xs font-semibold">{r.model || '—'}</td>
                            <td className="px-3 py-2.5 text-xs">{r.under_cabang || '—'}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap gap-0.5">
                                {r.src_oldp && <span className="text-[9px] px-1 rounded bg-blue-500/20 text-blue-300">OLDP</span>}
                                {r.src_sales && <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300">Jual</span>}
                                {r.src_sju && <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300">SJU</span>}
                                {r.src_wo && <span className="text-[9px] px-1 rounded bg-violet-500/20 text-violet-300">WO</span>}
                                {r.src_crm && <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300">CRM</span>}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {!rows.length && (
                        <tr>
                          <td colSpan={4} className="px-3 py-10 text-center text-surface-500 text-sm">
                            Tidak ada unit. Coba VIN lain.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-between text-xs text-surface-400 mt-2">
                <span>{total.toLocaleString('id-ID')} unit</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                    className="btn-secondary px-3 py-1 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="font-mono">
                    {page + 1}/{pages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= pages - 1}
                    onClick={() => setPage((p) => p + 1)}
                    className="btn-secondary px-3 py-1 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {(selectedUnitId || selectedVin) && (
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-surface-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-accent" />
                Detail unit
              </h3>
              <button type="button" onClick={closeDetail} className="text-xs text-surface-400 hover:text-surface-200">
                Tutup
              </button>
            </div>

            {masterLoading || !master ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <div className="card p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm text-accent font-bold">{master.vin || '—'}</p>
                      <p className="text-lg font-semibold text-surface-50">{master.unit_number}</p>
                      <p className="text-xs text-surface-400">
                        {master.model} · {master.group_type || '—'} · SN {master.serial_number || '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-1 rounded text-[10px] font-bold border ${
                          master.is_complete_oldp
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {master.master_stage}
                      </span>
                      <p className="text-[10px] text-surface-500 mt-1">{master.unit_status}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Flag on={!!master.src_oldp} label="OLDP" />
                    <Flag on={!!master.src_sales} label="Penjualan" />
                    <Flag on={!!master.src_sju} label="SJU" />
                    <Flag on={!!master.src_wo} label="WO AX" />
                    <Flag on={!!master.src_wo_comm} label="WO Comm" />
                    <Flag on={!!master.src_crm} label="CRM" />
                    <Flag on={!!master.src_process} label="Process" />
                    <Flag on={(master.doc_uploaded_count || 0) > 0} label={`Dok ${master.doc_uploaded_count}/${master.doc_count}`} />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-0 pt-1">
                    <Row k="Cabang" v={master.under_cabang} />
                    <Row k="Customer" v={master.customer} />
                    <Row k="Customer update" v={master.customer_update} />
                    <Row k="Lokasi" v={master.location} />
                    <Row k="Year delivery" v={master.year_delivery} />
                    <Row k="Stock status" v={master.stock_status} />
                    <Row k="Marketing" v={master.marketing_status} />
                    <Row k="Device no" v={master.device_number} />
                    <Row k="BL date" v={master.bl_date} />
                    <Row k="OLDP sales_date" v={master.oldp_sales_date} />
                    <Row k="OLDP arrival" v={master.oldp_arrival_date} />
                    <Row k="OLDP PDI" v={master.oldp_pdi_date} />
                    <Row k="Arrival check" v={master.arrival_check} />
                    <Row k="PDI check" v={master.pdi_check} />
                    <Row k="COMM check" v={master.comm_check} />
                    <Row k="MS1/2/3" v={`${master.ms_check_1 || '—'} / ${master.ms_check_2 || '—'} / ${master.ms_check_3 || '—'}`} />
                  </div>
                </div>

                {/* Penjualan */}
                <section className="card p-4">
                  <h4 className="text-xs font-bold text-surface-300 uppercase flex items-center gap-1.5 mb-2">
                    <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" /> Penjualan ({sales.length})
                  </h4>
                  {sales.length === 0 ? (
                    <p className="text-xs text-surface-500">Tidak ada data penjualan</p>
                  ) : (
                    <div className="space-y-2">
                      {sales.map((s: any) => (
                        <div key={s.id} className="text-xs grid sm:grid-cols-2 gap-x-4 border border-surface-800 rounded-lg p-2">
                          <Row k="Invoice" v={s.invoice_sales} />
                          <Row k="Salesman" v={s.salesman} />
                          <Row k="Cabang jual" v={s.branch_sales} />
                          <Row k="Bulan" v={s.sales_month} />
                          <Row k="LDP" v={s.ldp} />
                          <Row k="Service interval" v={s.service_interval} />
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* SJU */}
                <section className="card p-4">
                  <h4 className="text-xs font-bold text-surface-300 uppercase flex items-center gap-1.5 mb-2">
                    <Ship className="w-3.5 h-3.5 text-cyan-400" /> Keberangkatan SJU ({sju.length})
                  </h4>
                  {sju.length === 0 ? (
                    <p className="text-xs text-surface-500">Tidak ada data SJU</p>
                  ) : (
                    <div className="space-y-2">
                      {sju.map((d: any) => (
                        <div key={d.id} className="text-xs grid sm:grid-cols-2 gap-x-4 border border-surface-800 rounded-lg p-2">
                          <Row k="Pickup" v={d.pick_up_point} />
                          <Row k="Delivery" v={d.delivery_point} />
                          <Row k="Berangkat" v={d.berangkat_date} />
                          <Row k="Sampai" v={d.sampai_date} />
                          <Row k="Forwarder" v={d.forwarder} />
                          <Row k="Cabang" v={d.cabang} />
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* WO */}
                <section className="card p-4">
                  <h4 className="text-xs font-bold text-surface-300 uppercase flex items-center gap-1.5 mb-2">
                    <Wrench className="w-3.5 h-3.5 text-violet-400" /> Work Orders ({wos.length})
                  </h4>
                  {wos.length === 0 ? (
                    <p className="text-xs text-surface-500">Tidak ada WO</p>
                  ) : (
                    <div className="space-y-2">
                      {wos.map((w: any) => (
                        <div key={w.id} className="text-xs border border-surface-800 rounded-lg p-2 space-y-1">
                          <div className="flex flex-wrap gap-2 justify-between">
                            <span className="font-mono text-accent">{w.case_number}</span>
                            <span className="text-surface-400">{w.status}</span>
                          </div>
                          <p className="text-surface-200">{w.description}</p>
                          <div className="grid sm:grid-cols-2 gap-x-4">
                            <Row k="Type / group" v={`${w.type || '—'} / ${w.case_group || '—'}`} />
                            <Row k="PIC" v={w.person_in_charge} />
                            <Row k="Start" v={w.start_date} />
                            <Row k="Est. hours" v={w.estimated_hours} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* CRM */}
                <section className="card p-4">
                  <h4 className="text-xs font-bold text-surface-300 uppercase flex items-center gap-1.5 mb-2">
                    <Users className="w-3.5 h-3.5 text-amber-400" /> CRM ({crm.length})
                  </h4>
                  {crm.length === 0 ? (
                    <p className="text-xs text-surface-500">Tidak ada CRM</p>
                  ) : (
                    <div className="space-y-2">
                      {crm.map((c: any) => (
                        <div key={c.id} className="text-xs grid sm:grid-cols-2 gap-x-4 border border-surface-800 rounded-lg p-2">
                          <Row k="Dealer" v={c.dealer} />
                          <Row k="End customer" v={c.end_customer_name} />
                          <Row k="Product" v={`${c.product_type || ''} ${c.product_model || ''}`.trim()} />
                          <Row k="Indent" v={c.indent_no} />
                          <Row k="Approval" v={c.approval_status} />
                          <Row k="File status" v={c.file_status} />
                          <Row k="Arrival CRM" v={c.arrival_date} />
                          <Row k="Region" v={c.region} />
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Docs */}
                <section className="card p-4">
                  <h4 className="text-xs font-bold text-surface-300 uppercase flex items-center gap-1.5 mb-2">
                    <FileText className="w-3.5 h-3.5 text-rose-400" /> Dokumen ({docs.length})
                  </h4>
                  {docs.length === 0 ? (
                    <p className="text-xs text-surface-500">Tidak ada checklist dokumen</p>
                  ) : (
                    <ul className="space-y-1">
                      {docs.map((d: any, i: number) => (
                        <li key={i} className="flex justify-between text-xs py-1 border-b border-surface-800/40">
                          <span>
                            {(d.document_types as any)?.name || (d.document_types as any)?.code || 'Doc'}
                          </span>
                          <span
                            className={
                              d.status === 'uploaded' ? 'text-emerald-400' : 'text-surface-500'
                            }
                          >
                            {d.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <p className="text-[10px] text-surface-600 flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  Sumber: v_unit_master + unit_sales / unit_deliveries / work_orders / crm_records / unit_documents
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {!selectedUnitId && !selectedVin && !listLoading && rows.length > 0 && (
        <p className="text-xs text-surface-500 flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" />
          Klik baris unit untuk membuka detail semua sumber data.
        </p>
      )}
    </div>
  )
}
