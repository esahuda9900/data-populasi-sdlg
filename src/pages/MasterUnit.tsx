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
  { id: 'ms_gap', label: 'MS gap (stock)' },
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
      return { all: all.count ?? 0, sdlg: sdlg.count ?? 0, complete: complete.count ?? 0 }
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
      if (filter === 'ms_gap') q = q.eq('ms_status', 'MS_GAP')

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
      setMaintainMsg(`OK · alias ${r?.alias_count ?? '—'} · master ${r?.master_count ?? '—'} · SDLG ${r?.sdlg_count ?? '—'}`)
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
          <p className="text-sm text-surface-400">Stock age dari BL · MS1 di +3 bln · cari VIN / model+SN</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onMaintain} disabled={maintaining} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
            <Shield className={`w-3.5 h-3.5 ${maintaining ? 'animate-pulse' : ''}`} /> Maintain DB
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

      <div className="relative w-full sm:max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
        <input
          className="input pl-9 w-full text-sm font-mono"
          placeholder="VLGE… · E6210F 610003 · 610003"
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
        </p>
      )}

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
                        <th className="px-3 py-3">Stage / umur</th>
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
                              <div className="text-[10px] text-surface-500 truncate max-w-[140px]">{r.customer || r.crm_end_customer || '—'}</div>
                            </td>
                            <td className="px-3 py-2.5 text-xs">
                              <span className="font-semibold">{r.model || '—'}</span>
                              <span className="text-surface-500 font-mono ml-1">{r.sn6 || ''}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-[10px] font-mono text-surface-400 block">{r.master_stage}</span>
                              {r.stock_duration_text && (
                                <span className="text-[9px] text-violet-400/90">{r.stock_duration_text}</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap gap-0.5">
                                {r.is_sdlg_canonical && <span className="text-[9px] px-1 rounded bg-sky-500/20 text-sky-300">SDLG</span>}
                                {r.src_oldp && <span className="text-[9px] px-1 rounded bg-blue-500/20 text-blue-300">OLDP</span>}
                                {r.ms_status === 'MS_GAP' && <span className="text-[9px] px-1 rounded bg-rose-500/20 text-rose-300">MS gap</span>}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {!rows.length && (
                        <tr><td colSpan={4} className="px-3 py-10 text-center text-surface-500 text-sm">Tidak ada unit.</td></tr>
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
              <button type="button" onClick={() => { setSelectedUnitId(null); setSelectedVin(null) }} className="text-xs text-surface-400">Tutup</button>
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
                      <p className="text-xs text-surface-400">{master.model} · SN {master.sn6 || '—'}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold border ${
                        master.master_stage === 'COMPLETE_SOLD'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}>{master.master_stage}</span>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-x-6 pt-1">
                    <Row k="Cabang" v={master.under_cabang} />
                    <Row k="Customer" v={master.customer} />
                    <Row k="Marketing" v={master.marketing_status} />
                    <Row k="Ops" v={`Jual ${master.sales_count ?? 0} · SJU ${master.sju_count ?? 0} · WO ${master.wo_count ?? 0}`} />
                  </div>
                </div>

                <section className="card p-4 border-violet-500/25">
                  <h4 className="text-xs font-bold text-violet-300 uppercase mb-2">Stock age &amp; Maintenance stock (dari BL)</h4>
                  <p className="text-[10px] text-surface-500 mb-2">
                    Umur dari BL. MS1 = BL+3 bln, MS2 = +4, MS3 = +5, dst sampai sold &amp; PDI (atau hari ini jika masih stock).
                  </p>
                  <div className="grid sm:grid-cols-2 gap-x-6">
                    <Row k="BL (acuan)" v={master.stock_bl_date || master.bl_date || '—'} />
                    <Row k="Akhir hitung" v={master.stock_end_date || '—'} />
                    <Row k="Status stock" v={master.stock_status_label || '—'} />
                    <Row
                      k="Durasi stock"
                      v={
                        master.stock_duration_text
                          ? `${master.stock_duration_text}${master.stock_age_days != null ? ` (${master.stock_age_days} hari)` : ''}`
                          : '—'
                      }
                    />
                    <Row k="MS wajib (teori)" v={master.ms_required_count != null ? `${master.ms_required_count}×` : '—'} />
                    <Row k="MS tercatat OLDP" v={`${master.ms_done_count_oldp ?? 0}× (field MS1–3)`} />
                    <Row k="MS gap" v={master.ms_gap_count != null ? String(master.ms_gap_count) : '—'} />
                    <Row k="MS status" v={master.ms_status || '—'} />
                    <Row k="MS1 est / aktual" v={`${master.ms1_est_date || '—'} / ${master.oldp_ms1_date || '—'}`} />
                    <Row k="MS2 est / aktual" v={`${master.ms2_est_date || '—'} / ${master.oldp_ms2_date || '—'}`} />
                    <Row k="MS3 est / aktual" v={`${master.ms3_est_date || '—'} / ${master.oldp_ms3_date || '—'}`} />
                    <Row k="MS4 est" v={master.ms4_est_date || '—'} />
                  </div>
                </section>

                <section className="card p-4 border-sky-500/20">
                  <h4 className="text-xs font-bold text-sky-300 uppercase mb-2">SDLG · OLDP</h4>
                  <div className="grid sm:grid-cols-2 gap-x-6">
                    <Row k="Arrival" v={master.oldp_arrival_date} />
                    <Row k="PDI" v={master.oldp_pdi_date} />
                    <Row k="Sales date" v={master.oldp_sales_date} />
                    <Row k="Complete" v={master.has_oldp_sales ? 'YES' : 'NO'} />
                  </div>
                </section>

                <section className="card p-4 border-amber-500/20">
                  <h4 className="text-xs font-bold text-amber-300 uppercase mb-2">SDLG · CRM</h4>
                  <div className="grid sm:grid-cols-2 gap-x-6">
                    <Row k="End customer" v={master.crm_end_customer} />
                    <Row k="File status" v={master.crm_file_status} />
                    <Row k="Indent" v={master.crm_indent_no} />
                  </div>
                </section>

                <section className="card p-4">
                  <h4 className="text-xs font-bold text-surface-300 uppercase flex items-center gap-1.5 mb-2">
                    <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" /> Penjualan ({sales.length})
                  </h4>
                  {sales.length === 0 ? <p className="text-xs text-surface-500">Tidak ada</p> : sales.map((s: any) => (
                    <div key={s.id} className="text-xs border border-surface-800 rounded-lg p-2 mb-2">
                      <Row k="Invoice" v={s.invoice_sales} />
                      <Row k="Salesman" v={s.salesman} />
                    </div>
                  ))}
                </section>

                <section className="card p-4">
                  <h4 className="text-xs font-bold text-surface-300 uppercase flex items-center gap-1.5 mb-2">
                    <Ship className="w-3.5 h-3.5 text-cyan-400" /> SJU ({sju.length})
                  </h4>
                  {sju.length === 0 ? <p className="text-xs text-surface-500">Tidak ada</p> : sju.map((d: any) => (
                    <div key={d.id} className="text-xs border border-surface-800 rounded-lg p-2 mb-2">
                      <Row k="Delivery" v={d.delivery_point} />
                      <Row k="Berangkat" v={d.berangkat_date} />
                    </div>
                  ))}
                </section>

                <section className="card p-4">
                  <h4 className="text-xs font-bold text-surface-300 uppercase flex items-center gap-1.5 mb-2">
                    <Wrench className="w-3.5 h-3.5 text-violet-400" /> WO ({wos.length})
                  </h4>
                  {wos.length === 0 ? <p className="text-xs text-surface-500">Tidak ada</p> : wos.map((w: any) => (
                    <div key={w.id} className="text-xs border border-surface-800 rounded-lg p-2 mb-2">
                      <span className="font-mono text-accent">{w.case_number}</span> {w.status}
                      <p>{w.description}</p>
                    </div>
                  ))}
                </section>

                <p className="text-[10px] text-surface-600 flex items-center gap-1">
                  <Database className="w-3 h-3" /> stock age &amp; MS dari BL · BUSINESS_LOGIC §4
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
