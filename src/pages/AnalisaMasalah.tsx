import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { UnitMaster } from '../lib/master'
import {
  Search,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  Filter,
} from 'lucide-react'
import { TableSkeleton } from '../components/Skeleton'
import { useDebounce } from '../lib/useDebounce'
import { exportToCSV } from '../lib/exportUtils'

const PAGE_SIZE = 25

type FocusFilter =
  | 'sold_no_sales'
  | 'all_no_sales'
  | 'stock_no_sales'
  | 'sold_bl2026'
  | 'sold_no_pdi'
  | 'sold_no_sju'
  | 'sold_no_comm'

function isSold(m: UnitMaster): boolean {
  return (
    (m.sales_count ?? 0) > 0 ||
    !!m.src_sales ||
    (m.crm_file_status || '').toLowerCase() === 'sold' ||
    m.master_stage === 'COMPLETE_SOLD'
  )
}

function blYear(m: UnitMaster): number | null {
  const d = m.stock_bl_date || m.bl_date || m.oldp_bl_date
  if (!d) return null
  const y = Number(String(d).slice(0, 4))
  return Number.isFinite(y) ? y : null
}

function hasPdi(m: UnitMaster): boolean {
  return !!m.has_oldp_pdi || !!m.oldp_pdi_date
}

function hasSju(m: UnitMaster): boolean {
  return !!m.src_sju || (m.sju_count ?? 0) > 0
}

function hasComm(m: UnitMaster): boolean {
  return !!m.src_wo_comm
}

function severity(m: UnitMaster): number {
  let s = 0
  if (isSold(m) && !m.oldp_sales_date) s += 10
  if (blYear(m) === 2026) s += 8
  if (isSold(m) && !hasPdi(m)) s += 5
  if (isSold(m) && !hasSju(m)) s += 4
  if (isSold(m) && !hasComm(m)) s += 3
  return s
}

function Flag({ on, label, warn }: { on: boolean; label: string; warn?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
        on
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
          : warn
            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
            : 'bg-surface-800/60 text-surface-500 border-surface-700'
      }`}
    >
      {on ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
      {label}
    </span>
  )
}

const FOCUS: { id: FocusFilter; label: string; hint: string }[] = [
  { id: 'sold_no_sales', label: 'Terjual · tanpa sales date', hint: 'Prioritas utama: sudah indikasi jual, OLDP sales kosong' },
  { id: 'sold_bl2026', label: 'Terjual · BL 2026 (CSA)', hint: 'BL tahun 2026 → wajib CSA' },
  { id: 'sold_no_pdi', label: 'Terjual · belum PDI', hint: 'Sudah jual, PDI factory belum' },
  { id: 'sold_no_sju', label: 'Terjual · belum SJU', hint: 'Sudah jual, belum ada keberangkatan' },
  { id: 'sold_no_comm', label: 'Terjual · belum COMM', hint: 'Sudah jual, belum commissioning di cabang' },
  { id: 'stock_no_sales', label: 'Belum jual · tanpa sales date', hint: 'Stock / pipeline, wajar belum ada sales date' },
  { id: 'all_no_sales', label: 'Semua tanpa sales date', hint: 'Seluruh unit OLDP sales date kosong' },
]

export default function AnalisaMasalahPage() {
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 300)
  const [page, setPage] = useState(0)
  const [focus, setFocus] = useState<FocusFilter>('sold_no_sales')
  const [sdlgOnly, setSdlgOnly] = useState(true)

  const { data: kpis, isLoading: kpiLoading, refetch: refetchKpi, isRefetching } = useQuery({
    queryKey: ['analisa_kpis'],
    staleTime: 30_000,
    queryFn: async () => {
      const base = () => supabase.from('v_unit_master').select('*', { count: 'exact', head: true })
      const [
        total,
        sdlg,
        noSalesSdlg,
        soldNoSales,
        stockNoSales,
        soldBl2026,
        soldNoPdi,
        soldNoSju,
        soldNoComm,
      ] = await Promise.all([
        base(),
        base().eq('is_sdlg_canonical', true),
        base().is('oldp_sales_date', null).eq('is_sdlg_canonical', true),
        base()
          .is('oldp_sales_date', null)
          .eq('is_sdlg_canonical', true)
          .or('src_sales.eq.true,sales_count.gt.0,crm_file_status.ilike.sold,master_stage.eq.COMPLETE_SOLD'),
        base()
          .is('oldp_sales_date', null)
          .eq('is_sdlg_canonical', true)
          .eq('src_sales', false)
          .eq('sales_count', 0)
          .neq('master_stage', 'COMPLETE_SOLD'),
        base()
          .is('oldp_sales_date', null)
          .eq('is_sdlg_canonical', true)
          .or('src_sales.eq.true,sales_count.gt.0,crm_file_status.ilike.sold,master_stage.eq.COMPLETE_SOLD')
          .gte('stock_bl_date', '2026-01-01')
          .lt('stock_bl_date', '2027-01-01'),
        base()
          .is('oldp_sales_date', null)
          .eq('is_sdlg_canonical', true)
          .or('src_sales.eq.true,sales_count.gt.0,crm_file_status.ilike.sold,master_stage.eq.COMPLETE_SOLD')
          .is('oldp_pdi_date', null),
        base()
          .is('oldp_sales_date', null)
          .eq('is_sdlg_canonical', true)
          .or('src_sales.eq.true,sales_count.gt.0,crm_file_status.ilike.sold,master_stage.eq.COMPLETE_SOLD')
          .eq('src_sju', false),
        base()
          .is('oldp_sales_date', null)
          .eq('is_sdlg_canonical', true)
          .or('src_sales.eq.true,sales_count.gt.0,crm_file_status.ilike.sold,master_stage.eq.COMPLETE_SOLD')
          .eq('src_wo_comm', false),
      ])
      return {
        total: total.count ?? 0,
        sdlg: sdlg.count ?? 0,
        noSalesSdlg: noSalesSdlg.count ?? 0,
        soldNoSales: soldNoSales.count ?? 0,
        stockNoSales: stockNoSales.count ?? 0,
        soldBl2026: soldBl2026.count ?? 0,
        soldNoPdi: soldNoPdi.count ?? 0,
        soldNoSju: soldNoSju.count ?? 0,
        soldNoComm: soldNoComm.count ?? 0,
      }
    },
  })

  const { data: listData, isLoading: listLoading, refetch: refetchList } = useQuery({
    queryKey: ['analisa_list', focus, debounced, page, sdlgOnly],
    staleTime: 15_000,
    queryFn: async () => {
      let q = supabase.from('v_unit_master').select('*', { count: 'exact' }).is('oldp_sales_date', null)
      if (sdlgOnly) q = q.eq('is_sdlg_canonical', true)

      if (focus === 'sold_bl2026') {
        q = q.gte('stock_bl_date', '2026-01-01').lt('stock_bl_date', '2027-01-01')
      }
      if (focus === 'sold_no_pdi') q = q.is('oldp_pdi_date', null)
      if (focus === 'sold_no_sju') q = q.eq('src_sju', false)
      if (focus === 'sold_no_comm') q = q.eq('src_wo_comm', false)

      if (debounced.trim()) {
        const s = debounced.trim()
        q = q.or(
          `vin.ilike.%${s}%,unit_number.ilike.%${s}%,serial_number.ilike.%${s}%,model.ilike.%${s}%,customer.ilike.%${s}%,under_cabang.ilike.%${s}%`
        )
      }

      const needClientSold =
        focus === 'sold_no_sales' ||
        focus === 'stock_no_sales' ||
        focus === 'sold_bl2026' ||
        focus === 'sold_no_pdi' ||
        focus === 'sold_no_sju' ||
        focus === 'sold_no_comm'

      if (needClientSold) {
        q = q.order('unit_number', { ascending: true }).range(0, 499)
        const { data, error } = await q
        if (error) throw error
        let rows = (data || []) as UnitMaster[]
        if (focus === 'stock_no_sales') {
          rows = rows.filter((m) => !isSold(m))
        } else if (focus !== 'all_no_sales') {
          rows = rows.filter((m) => isSold(m))
        }
        if (focus === 'sold_bl2026') rows = rows.filter((m) => blYear(m) === 2026)
        if (focus === 'sold_no_pdi') rows = rows.filter((m) => !hasPdi(m))
        if (focus === 'sold_no_sju') rows = rows.filter((m) => !hasSju(m))
        if (focus === 'sold_no_comm') rows = rows.filter((m) => !hasComm(m))
        rows = rows.sort((a, b) => severity(b) - severity(a))
        const total = rows.length
        const from = page * PAGE_SIZE
        return { rows: rows.slice(from, from + PAGE_SIZE), total, capped: true }
      }

      const from = page * PAGE_SIZE
      q = q.order('unit_number', { ascending: true }).range(from, from + PAGE_SIZE - 1)
      const { data, error, count } = await q
      if (error) throw error
      return { rows: (data || []) as UnitMaster[], total: count ?? 0, capped: false }
    },
  })

  const rows = listData?.rows || []
  const total = listData?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const focusMeta = useMemo(() => FOCUS.find((f) => f.id === focus), [focus])

  const refetchAll = () => {
    refetchKpi()
    refetchList()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-800 pb-3">
        <div>
          <h2 className="text-xl font-bold text-surface-50 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Analisa Masalah
          </h2>
          <p className="text-sm text-surface-400">
            Fokus proses: sales date OLDP kosong → apakah sudah terjual → checklist BL 2026 / PDI / SJU / COMM
          </p>
        </div>
        <button type="button" onClick={refetchAll} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {kpiLoading ? (
        <TableSkeleton rows={2} cols={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="card px-3 py-2.5">
            <p className="text-[10px] text-surface-500 uppercase">Total master</p>
            <p className="text-xl font-bold text-surface-100">{(kpis?.total ?? 0).toLocaleString('id-ID')}</p>
            <p className="text-[10px] text-sky-400">SDLG {(kpis?.sdlg ?? 0).toLocaleString('id-ID')}</p>
          </div>
          <div className="card px-3 py-2.5 border-amber-500/20">
            <p className="text-[10px] text-amber-400/80 uppercase">Tanpa sales date (SDLG)</p>
            <p className="text-xl font-bold text-amber-300">{(kpis?.noSalesSdlg ?? 0).toLocaleString('id-ID')}</p>
            <p className="text-[10px] text-surface-500">stock ~{(kpis?.stockNoSales ?? 0).toLocaleString('id-ID')}</p>
          </div>
          <div className="card px-3 py-2.5 border-rose-500/25 bg-rose-500/5">
            <p className="text-[10px] text-rose-400/90 uppercase">Terjual · tanpa sales date</p>
            <p className="text-xl font-bold text-rose-300">{(kpis?.soldNoSales ?? 0).toLocaleString('id-ID')}</p>
            <p className="text-[10px] text-surface-500">prioritas operator</p>
          </div>
          <div className="card px-3 py-2.5 border-violet-500/20">
            <p className="text-[10px] text-violet-400/80 uppercase">Di antaranya BL 2026</p>
            <p className="text-xl font-bold text-violet-300">{(kpis?.soldBl2026 ?? 0).toLocaleString('id-ID')}</p>
            <p className="text-[10px] text-surface-500">CSA wajib</p>
          </div>
        </div>
      )}

      {kpis && (
        <div className="card p-4 space-y-2">
          <h3 className="text-xs font-bold text-surface-300 uppercase flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Breakdown unit terjual tanpa sales date OLDP
          </h3>
          <div className="grid sm:grid-cols-4 gap-2 text-center">
            <button type="button" onClick={() => { setFocus('sold_bl2026'); setPage(0) }} className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-2 hover:bg-violet-500/20">
              <p className="text-lg font-bold text-violet-300">{kpis.soldBl2026}</p>
              <p className="text-[10px] text-surface-400">BL 2026 → CSA</p>
            </button>
            <button type="button" onClick={() => { setFocus('sold_no_pdi'); setPage(0) }} className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-2 hover:bg-rose-500/20">
              <p className="text-lg font-bold text-rose-300">{kpis.soldNoPdi}</p>
              <p className="text-[10px] text-surface-400">Belum PDI</p>
            </button>
            <button type="button" onClick={() => { setFocus('sold_no_sju'); setPage(0) }} className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-2 hover:bg-cyan-500/20">
              <p className="text-lg font-bold text-cyan-300">{kpis.soldNoSju}</p>
              <p className="text-[10px] text-surface-400">Belum SJU</p>
            </button>
            <button type="button" onClick={() => { setFocus('sold_no_comm'); setPage(0) }} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-2 hover:bg-amber-500/20">
              <p className="text-lg font-bold text-amber-300">{kpis.soldNoComm}</p>
              <p className="text-[10px] text-surface-400">Belum COMM</p>
            </button>
          </div>
          <p className="text-[10px] text-surface-500">
            Logika jual: data penjualan / CRM Sold / stage COMPLETE_SOLD. Sales date = tanggal jual factory OLDP.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {FOCUS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => { setFocus(f.id); setPage(0) }}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              focus === f.id
                ? 'bg-accent/15 text-accent border-accent/40 font-semibold'
                : 'border-surface-700 text-surface-400 hover:bg-surface-800'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setSdlgOnly((v) => !v); setPage(0) }}
          className={`text-xs px-3 py-1.5 rounded-lg border ${
            sdlgOnly ? 'bg-sky-500/15 text-sky-300 border-sky-500/40' : 'border-surface-700 text-surface-400'
          }`}
        >
          {sdlgOnly ? 'SDLG saja' : 'Semua brand'}
        </button>
      </div>
      {focusMeta && <p className="text-[11px] text-surface-500">{focusMeta.hint}</p>}

      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            className="input pl-9 w-full text-sm font-mono"
            placeholder="VIN / unit / model / customer / cabang"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          />
          {search && (
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
              <X className="w-3.5 h-3.5 text-surface-400" />
            </button>
          )}
        </div>
        <button
          type="button"
          className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
          onClick={() =>
            exportToCSV(
              'analisa-masalah',
              rows.map((m) => ({
                vin: m.vin,
                unit: m.unit_number,
                model: m.model,
                customer: m.customer || m.crm_end_customer,
                cabang: m.under_cabang,
                sold: isSold(m) ? 'Y' : 'N',
                bl: m.stock_bl_date || m.bl_date,
                bl_year: blYear(m),
                csa_wajib: blYear(m) === 2026 ? 'Y' : 'N',
                pdi: hasPdi(m) ? 'Y' : 'N',
                sju: hasSju(m) ? 'Y' : 'N',
                comm: hasComm(m) ? 'Y' : 'N',
                sales_count: m.sales_count,
                stage: m.master_stage,
              })),
              [
                { key: 'vin', label: 'VIN' },
                { key: 'unit', label: 'Unit' },
                { key: 'model', label: 'Model' },
                { key: 'customer', label: 'Customer' },
                { key: 'cabang', label: 'Cabang' },
                { key: 'sold', label: 'Terjual' },
                { key: 'bl', label: 'BL' },
                { key: 'bl_year', label: 'Tahun BL' },
                { key: 'csa_wajib', label: 'CSA wajib' },
                { key: 'pdi', label: 'PDI' },
                { key: 'sju', label: 'SJU' },
                { key: 'comm', label: 'COMM' },
                { key: 'sales_count', label: 'Jml sales' },
                { key: 'stage', label: 'Stage' },
              ]
            )
          }
        >
          <Download className="w-3.5 h-3.5" /> Export halaman
        </button>
      </div>

      {listLoading ? (
        <TableSkeleton rows={10} cols={5} />
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto max-h-[65vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-950 z-10">
                  <tr className="border-b border-surface-800 text-xs text-surface-400 text-left">
                    <th className="px-3 py-3">Unit</th>
                    <th className="px-3 py-3">Status jual</th>
                    <th className="px-3 py-3">BL / CSA</th>
                    <th className="px-3 py-3">Proses</th>
                    <th className="px-3 py-3">Cabang · customer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/40">
                  {rows.map((m) => {
                    const sold = isSold(m)
                    const year = blYear(m)
                    const csa = year === 2026
                    return (
                      <tr key={m.unit_id} className="hover:bg-surface-800/30">
                        <td className="px-3 py-2.5">
                          <div className="font-mono text-[11px] text-accent">{m.vin || '—'}</div>
                          <div className="text-xs text-surface-200">{m.unit_number || '—'}</div>
                          <div className="text-[10px] text-surface-500">
                            {m.model} · SN {m.sn6 || m.serial_number || '—'}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          {sold ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                              TERJUAL
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold border bg-surface-800 text-surface-400 border-surface-700">
                              BELUM JUAL
                            </span>
                          )}
                          <div className="text-[10px] text-surface-500 mt-1">
                            sales {m.sales_count ?? 0} · {m.crm_file_status || m.master_stage || '—'}
                          </div>
                          <div className="text-[10px] text-rose-400/90 mt-0.5">OLDP sales: kosong</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-mono text-[11px] text-surface-300">
                            {m.stock_bl_date || m.bl_date || m.oldp_bl_date || '—'}
                          </div>
                          {csa ? (
                            <span className="text-[10px] text-violet-300 font-semibold">CSA wajib (BL 2026)</span>
                          ) : year ? (
                            <span className="text-[10px] text-surface-500">BL {year}</span>
                          ) : (
                            <span className="text-[10px] text-amber-400">BL kosong</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-0.5">
                            <Flag on={hasPdi(m)} label="PDI" warn={sold && !hasPdi(m)} />
                            <Flag on={hasSju(m)} label="SJU" warn={sold && !hasSju(m)} />
                            <Flag on={hasComm(m)} label="COMM" warn={sold && !hasComm(m)} />
                            <Flag on={!!m.src_wo} label="WO" />
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="text-xs text-surface-200">{m.under_cabang || '—'}</div>
                          <div className="text-[10px] text-surface-500 truncate max-w-[160px]">
                            {m.customer || m.crm_end_customer || '—'}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {!rows.length && (
                    <tr>
                      <td colSpan={5} className="px-3 py-12 text-center text-surface-500 text-sm">
                        Tidak ada unit pada filter ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-between text-xs text-surface-400">
            <span>
              {total.toLocaleString('id-ID')} unit
              {listData?.capped ? ' (max 500, diurut severity)' : ''}
            </span>
            <div className="flex gap-2 items-center">
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="btn-secondary px-3 py-1 disabled:opacity-40">
                Prev
              </button>
              <span className="font-mono">
                {page + 1}/{pages}
              </span>
              <button type="button" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="btn-secondary px-3 py-1 disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
