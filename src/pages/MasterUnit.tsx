import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  parseMasterSearch,
  maintainUnitMaster,
  type UnitMaster,
  type MasterFilter,
} from '../lib/master'
import {
  Search,
  X,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Package,
  ShoppingCart,
  Ship,
  Wrench,
  Database,
  ClipboardList,
  Link2,
  Shield,
} from 'lucide-react'
import { TableSkeleton, Skeleton } from '../components/Skeleton'
import { useDebounce } from '../lib/useDebounce'

const PAGE_SIZE = 25

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

const FILTERS: { id: MasterFilter; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'sdlg', label: 'SDLG saja' },
  { id: 'complete', label: 'Complete sold' },
  { id: 'gap_ops', label: 'Sold · gap SJU/WO' },
]

export default function MasterUnitPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 300)
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<MasterFilter>('sdlg')
  const [selectedVin, setSelectedVin] = useState<string | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [resolvedFromAlias, setResolvedFromAlias] = useState<string | null>(null)
  const [maintaining, setMaintaining] = useState(false)
  const [maintainMsg, setMaintainMsg] = useState<string | null>(null)

  const { data: aliasHit } = useQuery({
    queryKey: ['vin_alias_resolve', debounced],
    enabled: debounced.trim().length >= 8,
    staleTime: 60_000,
    queryFn: async () => {
      const s = debounced.trim().toUpperCase()
      const { data } = await supabase
        .from('vin_alias')
        .select('alias_vin, canonical_vin, reason')
        .or(`alias_vin.eq.${s},canonical_vin.eq.${s}`)
        .maybeSingle()
      return data
    },
  })

  const effectiveSearch =
    aliasHit?.alias_vin && debounced.trim().toUpperCase() === aliasHit.alias_vin.toUpperCase()
      ? aliasHit.canonical_vin
      : debounced

  useEffect(() => {
    if (aliasHit?.alias_vin && debounced.trim().toUpperCase() === aliasHit.alias_vin.toUpperCase()) {
      setResolvedFromAlias(aliasHit.alias_vin)
    } else setResolvedFromAlias(null)
  }, [aliasHit, debounced])

  const { data: stats } = useQuery({
    queryKey: ['v_unit_master_stats'],
    staleTime: 60_000,
    queryFn: async () => {
      const [all, sdlg, complete] = await Promise.all([
        supabase.from('v_unit_master').select('*', { count: 'exact', head: true }),
        supabase.from('v_unit_master').select('*', { count: 'exact', head: true }).eq('is_sdlg_canonical', true),
        supabase.from('v_unit_master').select('*', { count: 'exact', head: true }).eq('master_stage', 'COMPLETE_SOLD'),
      ])
      return {
        all: all.count ?? 0,
        sdlg: sdlg.count ?? 0,
        complete: complete.count ?? 0,
      }
    },
  })

  const { data: listData, isLoading: listLoading, refetch, isRefetching } = useQuery({
    queryKey: ['v_unit_master_list', effectiveSearch, page, filter],
    staleTime: 15_000,
    queryFn: async () => {
      let q = supabase.from('v_unit_master').select('*', { count: 'exact' })

      if (filter === 'sdlg') q = q.eq('is_sdlg_canonical', true)
      if (filter === 'complete') q = q.eq('master_stage', 'COMPLETE_SOLD')
      if (filter === 'gap_ops') {
        q = q.eq('master_stage', 'COMPLETE_SOLD').or('src_sju.eq.false,src_wo_comm.eq.false')
      }

      const parsed = parseMasterSearch(effectiveSearch)
      if (parsed.text) {
        const s = parsed.text
        if (parsed.model && parsed.sn6) {
          q = q.or(
            `match_key.eq.${parsed.model}|${parsed.sn6},vin.ilike.%${s}%,sn6.eq.${parsed.sn6},model.ilike.%${parsed.model}%`
          )
        } else if (/^\d{5,7}$/.test(s) && parsed.sn6) {
          q = q.or(`sn6.eq.${parsed.sn6},serial_number.eq.${parsed.sn6},vin.ilike.%${parsed.sn6}%`)
        } else {
          q = q.or(
            `vin.ilike.%${s}%,unit_number.ilike.%${s}%,serial_number.ilike.%${s}%,sn6.ilike.%${s}%,match_key.ilike.%${s}%,model.ilike.%${s}%,customer.ilike.%${s}%,crm_end_customer.ilike.%${s}%,under_cabang.ilike.%${s}%`
          )
        }
      }

      q = q.order('is_sdlg_canonical', { ascending: false }).order('unit_number', { ascending: true })

      const from = page * PAGE_SIZE
      const { data, error, count } = await q.range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      return { rows: (data || []) as UnitMaster[], total: count ?? 0 }
    },
  })

  const rows = listData?.rows || []
  const total = listData?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
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
      return data as UnitMaster | null
    },
  })

  const loadByUnit = async (table: string, order?: string) => {
    let q = supabase.from(table).select('*')
    if (order) q = q.order(order, { ascending: false })
    if (selectedUnitId && selectedVin) q = q.or(`unit_id.eq.${selectedUnitId},vin.eq.${selectedVin}`)
    else if (selectedUnitId) q = q.eq('unit_id', selectedUnitId)
    else q = q.eq('vin', selectedVin!)
    const { data, error } = await q
    if (error) throw error
    return data || []
  }

  const { data: sales = [] } = useQuery({
    queryKey: ['master_sales', selectedUnitId, selectedVin],
    enabled: detailEnabled,
    queryFn: () => loadByUnit('unit_sales'),
  })
  const { data: sju = [] } = useQuery({
    queryKey: ['master_sju', selectedUnitId, selectedVin],
    enabled: detailEnabled,
    queryFn: () => loadByUnit('unit_deliveries'),
  })
  const { data: wos = [] } = useQuery({
    queryKey: ['master_wo', selectedUnitId, selectedVin],
    enabled: detailEnabled,
    queryFn: () => loadByUnit('work_orders', 'start_date'),
  })

  const onMaintain = async () => {
    setMaintaining(true)
    setMaintainMsg(null)
    try {
      const r = await maintainUnitMaster()
      setMaintainMsg(
        `OK · alias ${r?.alias_count ?? '—'} · master ${r?.master_count ?? '—'} · SDLG ${r?.sdlg_count ?? '—'}`
      )
      await qc.invalidateQueries({ queryKey: ['v_unit_master_list'] })
      await qc.invalidateQueries({ queryKey: ['v_unit_master_stats'] })
      await qc.invalidateQueries({ queryKey: ['v_unit_master_one'] })
      refetch()
    } catch (e: any) {
      setMaintainMsg(e?.message || 'Gagal maintain')
    } finally {
      setMaintaining(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-800 pb-3">
        <div>
          <h2 className="text-xl font-bold text-surface-50">Master Data Unit</h2>
          <p className="text-sm text-surface-400">
            Backend: VIN SDLG → alias → model|sn6. Frontend: filter + detail OLDP/CRM + ops.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onMaintain}
            disabled={maintaining}
            className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
            title="Refresh vin_alias + relink sales/SJU/WO ke kanonik"
          >
            <Shield className={`w-3.5 h-3.5 ${maintaining ? 'animate-pulse' : ''}`} />
            Maintain DB
          </button>
          <button type="button" onClick={() => refetch()} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="card px-3 py-2 text-center">
            <p className="text-[10px] text-surface-500 uppercase">Master</p>
            <p className="text-lg font-bold text-surface-100">{stats.all.toLocaleString('id-ID')}</p>
          </div>
          <div className="card px-3 py-2 text-center border-sky-500/20">
            <p className="text-[10px] text-sky-400/80 uppercase">SDLG</p>
            <p className="text-lg font-bold text-sky-300">{stats.sdlg.toLocaleString('id-ID')}</p>
          </div>
          <div className="card px-3 py-2 text-center border-emerald-500/20">
            <p className="text-[10px] text-emerald-400/80 uppercase">Complete sold</p>
            <p className="text-lg font-bold text-emerald-300">{stats.complete.toLocaleString('id-ID')}</p>
          </div>
        </div>
      )}

      {maintainMsg && <p className="text-xs text-surface-400 font-mono">{maintainMsg}</p>}

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => { setFilter(f.id); setPage(0) }}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              filter === f.id
                ? 'bg-accent/15 text-accent border-accent/40 font-semibold'
                : 'border-surface-700 text-surface-400 hover:bg-surface-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="relative w-full sm:max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            className="input pl-9 w-full text-sm font-mono"
            placeholder="VLGE… · E6210F 610003 · 610003 · customer…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          />
          {search && (
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
              <X className="w-3.5 h-3.5 text-surface-400" />
            </button>
          )}
        </div>
        {resolvedFromAlias && aliasHit && (
          <p className="text-xs text-amber-400/90 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" />
            Typo <span className="font-mono">{resolvedFromAlias}</span> →{' '}
            <span className="font-mono text-accent">{aliasHit.canonical_vin}</span>
            <span className="text-surface-500">({aliasHit.reason})</span>
          </p>
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
                        <th className="px-3 py-3">Model · SN</th>
                        <th className="px-3 py-3">Stage</th>
                        <th className="px-3 py-3">Sumber</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-800/40">
                      {rows.map((r) => {
                        const active = r.unit_id === selectedUnitId
                        return (
                          <tr
                            key={r.unit_id}
                            onClick={() => { setSelectedUnitId(r.unit_id); setSelectedVin(r.vin) }}
                            className={`cursor-pointer transition-colors ${active ? 'bg-accent/10' : 'hover:bg-surface-800/40'}`}
                          >
                            <td className="px-3 py-2.5">
                              <div className="font-mono text-[11px] text-accent">{r.vin || '—'}</div>
                              <div className="text-xs text-surface-200">{r.unit_number || '—'}</div>
                              <div className="text-[10px] text-surface-500 truncate max-w-[140px]">
                                {r.customer || r.crm_end_customer || '—'}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-xs">
                              <span className="font-semibold">{r.model || '—'}</span>
                              <span className="text-surface-500 font-mono ml-1">{r.sn6 || ''}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-[10px] font-mono text-surface-400">{r.master_stage}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap gap-0.5">
                                {r.is_sdlg_canonical && (
                                  <span className="text-[9px] px-1 rounded bg-sky-500/20 text-sky-300">SDLG</span>
                                )}
                                {r.src_oldp && <span className="text-[9px] px-1 rounded bg-blue-500/20 text-blue-300">OLDP</span>}
                                {r.src_crm && <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300">CRM</span>}
                                {r.src_sales && <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300">Jual</span>}
                                {r.src_sju && <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300">SJU</span>}
                                {r.src_wo && <span className="text-[9px] px-1 rounded bg-violet-500/20 text-violet-300">WO</span>}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {!rows.length && (
                        <tr>
                          <td colSpan={4} className="px-3 py-10 text-center text-surface-500 text-sm">
                            Tidak ada unit untuk filter/cari ini.
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
                  <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="btn-secondary px-3 py-1 disabled:opacity-40">Prev</button>
                  <span className="font-mono">{page + 1}/{pages}</span>
                  <button type="button" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="btn-secondary px-3 py-1 disabled:opacity-40">Next</button>
                </div>
              </div>
            </>
          )}
        </div>

        {(selectedUnitId || selectedVin) && (
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-surface-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-accent" /> Detail unit
              </h3>
              <button type="button" onClick={() => { setSelectedUnitId(null); setSelectedVin(null) }} className="text-xs text-surface-400">
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
                        {master.model} · SN {master.sn6 || '—'}
                        {master.match_key ? <span className="text-surface-600 font-mono ml-2">{master.match_key}</span> : null}
                      </p>
                      {Array.isArray(master.alias_vins) && master.alias_vins.length > 0 && (
                        <p className="text-[10px] text-amber-400/80 mt-1 flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> Alias: {master.alias_vins.join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-1 rounded text-[10px] font-bold border ${
                          master.master_stage === 'COMPLETE_SOLD'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {master.master_stage}
                      </span>
                      <p className="text-[10px] text-surface-500 mt-1">
                        {master.is_sdlg_canonical ? 'SDLG canonical · ' : 'Non-SDLG · '}{master.unit_status}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Flag on={!!master.src_oldp} label="OLDP" />
                    <Flag on={!!master.src_crm} label="CRM" />
                    <Flag on={!!master.src_sales} label="Penjualan" />
                    <Flag on={!!master.src_sju} label="SJU" />
                    <Flag on={!!master.src_wo} label="WO" />
                    <Flag on={!!master.src_wo_comm} label="WO Comm" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-x-6 pt-1">
                    <Row k="Cabang" v={master.under_cabang} />
                    <Row k="Customer" v={master.customer} />
                    <Row k="Lokasi" v={master.location} />
                    <Row k="Stock / mkt" v={`${master.stock_status || '—'} / ${master.marketing_status || '—'}`} />
                    <Row k="Device" v={master.device_number} />
                    <Row k="Ops" v={`Jual ${master.sales_count ?? 0} · SJU ${master.sju_count ?? 0} · WO ${master.wo_count ?? 0}`} />
                  </div>
                </div>

                <section className="card p-4 border-sky-500/20">
                  <h4 className="text-xs font-bold text-sky-300 uppercase mb-2">SDLG · OLDP lifecycle</h4>
                  <div className="grid sm:grid-cols-2 gap-x-6">
                    <Row k="Country / dealer" v={`${master.oldp_country || '—'} / ${master.oldp_dealer || '—'}`} />
                    <Row k="Model code" v={master.oldp_model_code || master.model} />
                    <Row k="BL" v={master.oldp_bl_date || master.bl_date} />
                    <Row k="Arrival" v={master.oldp_arrival_date} />
                    <Row k="MS1 / MS2 / MS3" v={`${master.oldp_ms1_date || '—'} / ${master.oldp_ms2_date || '—'} / ${master.oldp_ms3_date || '—'}`} />
                    <Row k="PDI" v={master.oldp_pdi_date} />
                    <Row k="Sales date" v={master.oldp_sales_date} />
                    <Row k="Complete" v={master.has_oldp_sales ? 'YES' : 'NO'} />
                  </div>
                </section>

                <section className="card p-4 border-amber-500/20">
                  <h4 className="text-xs font-bold text-amber-300 uppercase mb-2">SDLG · CRM commercial</h4>
                  <div className="grid sm:grid-cols-2 gap-x-6">
                    <Row k="Dealer" v={master.crm_dealer} />
                    <Row k="Product" v={`${master.crm_product_type || ''} ${master.crm_product_model || ''}`.trim() || '—'} />
                    <Row k="Indent" v={master.crm_indent_no} />
                    <Row k="End customer" v={master.crm_end_customer} />
                    <Row k="File status" v={master.crm_file_status} />
                    <Row k="Approval" v={master.crm_approval_status} />
                    <Row k="Arrival CRM" v={master.crm_arrival_date} />
                    <Row k="Region" v={master.crm_region || master.crm_area} />
                  </div>
                </section>

                <section className="card p-4">
                  <h4 className="text-xs font-bold text-surface-300 uppercase flex items-center gap-1.5 mb-2">
                    <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" /> Penjualan lokal ({sales.length})
                  </h4>
                  {sales.length === 0 ? <p className="text-xs text-surface-500">Tidak ada</p> : (
                    <div className="space-y-2">
                      {sales.map((s: any) => (
                        <div key={s.id} className="text-xs grid sm:grid-cols-2 gap-x-4 border border-surface-800 rounded-lg p-2">
                          <Row k="Invoice" v={s.invoice_sales} />
                          <Row k="Salesman" v={s.salesman} />
                          <Row k="Cabang" v={s.branch_sales} />
                          <Row k="Bulan" v={s.sales_month} />
                          <Row k="LDP" v={s.ldp} />
                          <Row k="Service" v={s.service_interval} />
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="card p-4">
                  <h4 className="text-xs font-bold text-surface-300 uppercase flex items-center gap-1.5 mb-2">
                    <Ship className="w-3.5 h-3.5 text-cyan-400" /> SJU lokal ({sju.length})
                  </h4>
                  {sju.length === 0 ? <p className="text-xs text-surface-500">Tidak ada</p> : (
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

                <section className="card p-4">
                  <h4 className="text-xs font-bold text-surface-300 uppercase flex items-center gap-1.5 mb-2">
                    <Wrench className="w-3.5 h-3.5 text-violet-400" /> WO lokal ({wos.length})
                  </h4>
                  {wos.length === 0 ? <p className="text-xs text-surface-500">Tidak ada</p> : (
                    <div className="space-y-2">
                      {wos.map((w: any) => (
                        <div key={w.id} className="text-xs border border-surface-800 rounded-lg p-2 space-y-1">
                          <div className="flex justify-between">
                            <span className="font-mono text-accent">{w.case_number}</span>
                            <span>{w.status}</span>
                          </div>
                          <p className="text-surface-200">{w.description}</p>
                          <div className="grid sm:grid-cols-2 gap-x-4">
                            <Row k="Type / group" v={`${w.type || '—'} / ${w.case_group || '—'}`} />
                            <Row k="PIC" v={w.person_in_charge} />
                            <Row k="Start" v={w.start_date} />
                            <Row k="Hours" v={w.estimated_hours} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <p className="text-[10px] text-surface-600 flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  maintain_unit_master() · resolve_unit_id() · v_unit_master
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {!selectedUnitId && !listLoading && rows.length > 0 && (
        <p className="text-xs text-surface-500 flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" />
          Default filter <b>SDLG saja</b>. Maintain DB setelah upload OLDP/CRM baru.
        </p>
      )}
    </div>
  )
}
