import {
  ShoppingCart,
  Ship,
  Wrench,
  Database,
  Phone,
  MapPin,
  Building,
  User,
  Calendar,
  Hash,
  AlertCircle,
  Factory,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import type { UnitSales, UnitDelivery, WorkOrder, CrmRecord, UnitOldpFlags } from '../lib/supabase'

/** Label–value row used in multi-source detail panels */
export function KV({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  const empty = v === null || v === undefined || v === ''
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-surface-800/40 text-xs">
      <span className="text-surface-500 shrink-0">{k}</span>
      <span className={`text-right break-all ${empty ? 'text-surface-600' : 'text-surface-200'} ${mono ? 'font-mono' : ''}`}>
        {empty ? '—' : v}
      </span>
    </div>
  )
}

export function EmptySource({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-surface-700 bg-surface-900/40 px-4 py-8 text-center">
      <AlertCircle className="w-5 h-5 text-surface-600 mx-auto mb-2" />
      <p className="text-xs text-surface-500">Belum ada data {label} untuk unit ini</p>
    </div>
  )
}

export function SalesPanel({ rows }: { rows: UnitSales[] }) {
  if (!rows.length) return <EmptySource label="penjualan" />
  return (
    <div className="space-y-3">
      {rows.map((s) => (
        <div key={s.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 space-y-0.5">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-300">
              Invoice {s.invoice_sales || '—'}
            </span>
            {s.sales_month && (
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-mono">
                {s.sales_month}
              </span>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <KV k="Salesman" v={s.salesman} />
            <KV k="Branch sales" v={s.branch_sales} />
            <KV k="LDP / lokasi" v={s.ldp} />
            <KV k="Sales month" v={s.sales_month} />
            <KV k="Filter interval" v={s.filter_interval} />
            <KV k="Oil interval" v={s.oil_interval} />
            <KV k="Service interval" v={s.service_interval} />
            <KV
              k="Customer phone"
              v={
                s.customer_phone ? (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {s.customer_phone}
                  </span>
                ) : null
              }
            />
            <KV k="VIN" v={s.vin} mono />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SjuPanel({ rows }: { rows: UnitDelivery[] }) {
  if (!rows.length) return <EmptySource label="SJU / pengiriman" />
  return (
    <div className="space-y-3">
      {rows.map((d) => (
        <div key={d.id} className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3.5 space-y-0.5">
          <div className="flex items-center gap-2 mb-2">
            <Ship className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-bold text-cyan-300">
              {d.tipe_unit || d.brand || 'SJU'}
            </span>
            {d.cabang && (
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                {d.cabang}
              </span>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <KV k="Brand" v={d.brand} />
            <KV k="Tipe unit" v={d.tipe_unit} />
            <KV k="Customer cabang" v={d.customer_cabang} />
            <KV k="Cabang" v={d.cabang} />
            <KV
              k="Pick-up"
              v={
                d.pick_up_point ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {d.pick_up_point}
                  </span>
                ) : null
              }
            />
            <KV
              k="Delivery point"
              v={
                d.delivery_point ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {d.delivery_point}
                  </span>
                ) : null
              }
            />
            <KV k="Berangkat" v={d.berangkat_date} />
            <KV k="Sampai" v={d.sampai_date} />
            <KV k="Forwarder" v={d.forwarder} />
            <KV
              k="Harga"
              v={
                d.harga != null
                  ? Number(d.harga).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
                  : null
              }
            />
            <KV k="VIN" v={d.vin} mono />
          </div>
        </div>
      ))}
    </div>
  )
}

export function WoPanel({ rows }: { rows: WorkOrder[] }) {
  if (!rows.length) return <EmptySource label="work order" />
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-violet-300/80 bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2">
        <strong>Primary resource</strong> = acuan under cabang paling akurat (update operasional terakhir).
        <strong> Start date</strong> bisa disarankan sebagai sales date jika OLDP kosong.
      </p>
      {rows.map((w) => (
        <div key={w.id} className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3.5 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Wrench className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs font-bold text-violet-300 font-mono">{w.case_number || 'WO'}</span>
            {w.status && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-300 border border-surface-700">
                {w.status}
              </span>
            )}
            {w.type && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/25">
                {w.type}
              </span>
            )}
            {w.start_date && (
              <span className="ml-auto text-[10px] font-mono text-surface-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {w.start_date}
              </span>
            )}
          </div>
          {w.description && (
            <p className="text-[11px] text-surface-300 mb-2 leading-relaxed">{w.description}</p>
          )}
          <div className="grid sm:grid-cols-2 gap-x-4">
            <KV
              k="Primary resource (cabang)"
              v={
                w.primary_resource ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-violet-200">
                    <Building className="w-3 h-3" />
                    {w.primary_resource}
                  </span>
                ) : null
              }
            />
            <KV k="Case group" v={w.case_group} />
            <KV k="Customer account" v={w.customer_account} />
            <KV k="Custodian / customer" v={w.custodian} />
            <KV k="Delivery name" v={w.delivery_name} />
            <KV k="Device name" v={w.device_name} />
            <KV k="Device number" v={w.device_number} mono />
            <KV
              k="PIC"
              v={
                w.person_in_charge ? (
                  <span className="inline-flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {w.person_in_charge}
                  </span>
                ) : null
              }
            />
            <KV k="Start date" v={w.start_date} />
            <KV k="Est. hours" v={w.estimated_hours != null ? String(w.estimated_hours) : null} />
            <KV k="VIN" v={w.vin} mono />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CrmPanel({ rows }: { rows: CrmRecord[] }) {
  if (!rows.length) return <EmptySource label="CRM" />
  return (
    <div className="space-y-3">
      {rows.map((c) => (
        <div key={c.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-amber-300">{c.end_customer_name || c.dealer || 'CRM'}</span>
            {c.approval_status && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                {c.approval_status}
              </span>
            )}
            {c.file_status && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-300 border border-surface-700">
                File: {c.file_status}
              </span>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <KV k="Dealer" v={c.dealer} />
            <KV k="End customer" v={c.end_customer_name} />
            <KV k="Product type" v={c.product_type} />
            <KV k="Product model" v={c.product_model} />
            <KV k="Indent no" v={c.indent_no} mono />
            <KV k="Region" v={c.region} />
            <KV k="Area" v={c.area} />
            <KV k="District" v={c.district} />
            <KV k="Arrival date" v={c.arrival_date} />
            <KV k="Sales date dealer" v={c.sales_date_dealer} />
            <KV k="Sales date end customer" v={c.sales_date_end_customer} />
            <KV k="Warranty start" v={c.warranty_start_date} />
            <KV k="Out of wty (critical)" v={c.out_of_warranty_critical} />
            <KV k="Out of wty (other)" v={c.out_of_warranty_other} />
            <KV k="PIC" v={c.person_in_charge} />
            <KV k="VIN" v={c.vin} mono />
          </div>
        </div>
      ))}
    </div>
  )
}

export function OldpPanel({ row, matchedVin }: { row: UnitOldpFlags | null; matchedVin?: string | null }) {
  if (!row) return <EmptySource label="OLDP / factory" />

  const Flag = ({ ok, label }: { ok: boolean | null | undefined; label: string }) => (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-semibold ${
        ok
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
          : 'bg-surface-800 text-surface-500 border-surface-700'
      }`}
    >
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </span>
  )

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-rose-300/80 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
        Sumber <strong>SDLG OLDP (factory)</strong>. Sales date di sini = tanggal penjualan dari factory.
        Jika kosong, operator bisa pakai <strong>WO start date</strong> sebagai acuan.
        {matchedVin && matchedVin !== row.vin && (
          <span className="block mt-1 text-amber-300">
            Match via VIN alternatif: master <span className="font-mono">{matchedVin}</span> → OLDP{' '}
            <span className="font-mono">{row.vin}</span>
          </span>
        )}
      </p>
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Factory className="w-3.5 h-3.5 text-rose-400" />
          <span className="text-xs font-bold text-rose-300 font-mono">{row.vin}</span>
          {row.model_code && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/25">
              {row.model_code}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Flag ok={row.has_arrival} label="Arrival" />
          <Flag ok={row.has_ms1} label="MS1" />
          <Flag ok={row.has_ms2} label="MS2" />
          <Flag ok={row.has_ms3} label="MS3" />
          <Flag ok={row.has_pdi} label="PDI" />
          <Flag ok={row.has_sales} label="Sales" />
        </div>
        <div className="grid sm:grid-cols-2 gap-x-4">
          <KV k="Country" v={row.country_name} />
          <KV k="Dealer" v={row.dealer_name} />
          <KV k="Model code" v={row.model_code} />
          <KV k="VIN (OLDP)" v={row.vin} mono />
          <KV k="BL ship-out / BL date" v={row.bl_date} />
          <KV k="Arrival date" v={row.arrival_date} />
          <KV k="MS1 date" v={row.ms1_date} />
          <KV k="MS2 date" v={row.ms2_date} />
          <KV k="MS3 date" v={row.ms3_date} />
          <KV k="PDI date" v={row.pdi_date} />
          <KV
            k="Sales date (factory)"
            v={
              row.sales_date ? (
                <span className="font-semibold text-rose-200">{row.sales_date}</span>
              ) : (
                <span className="text-amber-400">KOSONG — saran: pakai WO start date</span>
              )
            }
          />
          <KV k="Refreshed at" v={row.refreshed_at ? String(row.refreshed_at).slice(0, 19) : null} mono />
        </div>
      </div>
    </div>
  )
}

/** Resolve under_cabang priority: WO primary_resource → SJU cabang → units */
export function resolveUnderCabang(
  unitCabang: string | null | undefined,
  wos: WorkOrder[],
  deliveries: UnitDelivery[]
): { value: string | null; source: string } {
  const fromWo = wos.map((w) => w.primary_resource).find((x) => x && String(x).trim())
  if (fromWo) return { value: String(fromWo).trim(), source: 'WO primary_resource' }
  const fromSju =
    deliveries.map((d) => d.cabang || d.customer_cabang).find((x) => x && String(x).trim())
  if (fromSju) return { value: String(fromSju).trim(), source: 'SJU' }
  if (unitCabang && unitCabang.trim()) return { value: unitCabang.trim(), source: 'Master unit' }
  return { value: null, source: '—' }
}

/** Marketing: VIN ada di unit_sales → ITR, else ITU */
export function deriveMarketing(salesCount: number): 'ITR' | 'ITU' {
  return salesCount > 0 ? 'ITR' : 'ITU'
}
