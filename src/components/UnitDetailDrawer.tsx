import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  supabase,
  Unit,
  UnitProcess,
  UnitSales,
  UnitDelivery,
  WorkOrder,
  CrmRecord,
  UnitOldpFlags,
} from '../lib/supabase'
import {
  X,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Save,
  Loader2,
  ShoppingCart,
  Ship,
  Wrench,
  Database,
  Calendar,
  Factory,
} from 'lucide-react'
import { resolveUnitModel, POPULAR_SDLG_MODELS } from '../lib/modelUtils'
import {
  SalesPanel,
  SjuPanel,
  WoPanel,
  CrmPanel,
  OldpPanel,
  resolveUnderCabang,
  deriveMarketing,
} from './UnitSourcePanels'

interface UnitDetailDrawerProps {
  unit: Unit | null
  onClose: () => void
}

type Tab = 'info' | 'oldp' | 'sales' | 'sju' | 'wo' | 'crm' | 'process' | 'documents'

export default function UnitDetailDrawer({ unit, onClose }: UnitDetailDrawerProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('info')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [isEditingFull, setIsEditingFull] = useState(false)
  const [isSavingUnit, setIsSavingUnit] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    unit_number: '',
    vin: '',
    model: '',
    customModel: '',
    under_cabang: '',
    customer: '',
    location: '',
    year_delivery: '',
    status: 'aktif',
    serial_number: '',
    marketing_status: '',
    device_number: '',
  })

  const resolved = resolveUnitModel(unit)

  useEffect(() => {
    if (!unit) return
    const resolvedModelVal = unit.model || resolved.model || ''
    const isCustom = !POPULAR_SDLG_MODELS.includes(resolvedModelVal) && resolvedModelVal !== ''
    setEditForm({
      unit_number: unit.unit_number || '',
      vin: unit.vin || '',
      model: isCustom ? 'CUSTOM' : resolvedModelVal,
      customModel: isCustom ? resolvedModelVal : '',
      under_cabang: unit.under_cabang || '',
      customer: unit.customer || '',
      location: unit.location || '',
      year_delivery: unit.year_delivery ? String(unit.year_delivery) : '',
      status: unit.status || 'aktif',
      serial_number: unit.serial_number || '',
      marketing_status: unit.marketing_status || '',
      device_number: unit.device_number || '',
    })
    setIsEditingFull(false)
    setSaveError(null)
    setActiveTab('info')
  }, [unit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { data: processData } = useQuery<UnitProcess | null>({
    queryKey: ['unit_process_detail', unit?.vin],
    enabled: !!unit?.vin,
    queryFn: async () => {
      if (!unit?.vin) return null
      const { data } = await supabase.from('unit_process').select('*').eq('vin', unit.vin).maybeSingle()
      return (data as UnitProcess) || null
    },
  })

  const { data: documentsData = [] } = useQuery({
    queryKey: ['unit_docs_detail', unit?.id],
    enabled: !!unit?.id,
    queryFn: async () => {
      if (!unit?.id) return []
      const { data } = await supabase
        .from('unit_documents')
        .select('id, status, file_name, document_types (id, name, code)')
        .eq('unit_id', unit.id)
      return data || []
    },
  })

  const loadByUnit = async (table: string, orderCol?: string) => {
    if (!unit) return []
    let q = supabase.from(table).select('*')
    if (orderCol) q = q.order(orderCol, { ascending: false })
    if (unit.id && unit.vin) q = q.or(`unit_id.eq.${unit.id},vin.eq.${unit.vin}`)
    else if (unit.id) q = q.eq('unit_id', unit.id)
    else if (unit.vin) q = q.eq('vin', unit.vin)
    else return []
    const { data, error } = await q
    if (error) {
      console.warn(table, error.message)
      return []
    }
    return data || []
  }

  const { data: salesRows = [] } = useQuery<UnitSales[]>({
    queryKey: ['drawer_sales', unit?.id, unit?.vin],
    enabled: !!(unit?.id || unit?.vin),
    queryFn: () => loadByUnit('unit_sales') as Promise<UnitSales[]>,
  })
  const { data: sjuRows = [] } = useQuery<UnitDelivery[]>({
    queryKey: ['drawer_sju', unit?.id, unit?.vin],
    enabled: !!(unit?.id || unit?.vin),
    queryFn: () => loadByUnit('unit_deliveries') as Promise<UnitDelivery[]>,
  })
  const { data: woRows = [] } = useQuery<WorkOrder[]>({
    queryKey: ['drawer_wo', unit?.id, unit?.vin],
    enabled: !!(unit?.id || unit?.vin),
    queryFn: () => loadByUnit('work_orders', 'start_date') as Promise<WorkOrder[]>,
  })
  const { data: crmRows = [] } = useQuery<CrmRecord[]>({
    queryKey: ['drawer_crm', unit?.id, unit?.vin],
    enabled: !!(unit?.id || unit?.vin),
    queryFn: () => loadByUnit('crm_records') as Promise<CrmRecord[]>,
  })

  /** Smart OLDP lookup: exact VIN → insert/remove 0 before serial → serial suffix */
  const { data: oldpRow = null } = useQuery<UnitOldpFlags | null>({
    queryKey: ['drawer_oldp', unit?.vin, unit?.serial_number],
    enabled: !!(unit?.vin || unit?.serial_number),
    queryFn: async () => {
      if (!unit) return null
      const tryVins: string[] = []
      const vin = (unit.vin || '').trim()
      const serial = (unit.serial_number || '').trim()
      if (vin) tryVins.push(vin)
      const mIns = vin.match(/^(.*?)(\d{5,7})$/)
      if (mIns) {
        const alt = mIns[1] + '0' + mIns[2]
        if (!tryVins.includes(alt)) tryVins.push(alt)
      }
      const mRm = vin.match(/^(.*?)0(\d{5,7})$/)
      if (mRm) {
        const alt = mRm[1] + mRm[2]
        if (!tryVins.includes(alt)) tryVins.push(alt)
      }
      for (const v of tryVins) {
        const { data, error } = await supabase
          .from('unit_oldp_flags')
          .select('*')
          .eq('vin', v)
          .maybeSingle()
        if (!error && data) return data as UnitOldpFlags
      }
      if (serial && serial.length >= 5) {
        const { data } = await supabase
          .from('unit_oldp_flags')
          .select('*')
          .ilike('vin', `%${serial}`)
          .limit(1)
        if (data?.[0]) return data[0] as UnitOldpFlags
      }
      return null
    },
  })

  if (!unit) return null

  const marketingDerived = deriveMarketing(salesRows.length)
  const cabangResolved = resolveUnderCabang(unit.under_cabang, woRows, sjuRows)
  const latestWoDate = woRows.map((w) => w.start_date).find((d) => d)
  const storedMarketing = (unit.marketing_status || '').toUpperCase()
  const marketingMismatch =
    !!storedMarketing &&
    storedMarketing !== marketingDerived &&
    !storedMarketing.includes(marketingDerived)

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleSaveFullUnit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsSavingUnit(true)
    setSaveError(null)
    try {
      const finalModel = editForm.model === 'CUSTOM' ? editForm.customModel.trim() : editForm.model
      const yearDelivNum = editForm.year_delivery ? parseInt(editForm.year_delivery, 10) : null
      const { error } = await supabase
        .from('units')
        .update({
          unit_number: editForm.unit_number.trim(),
          vin: editForm.vin.trim() || null,
          model: finalModel || null,
          under_cabang: editForm.under_cabang.trim() || null,
          customer: editForm.customer.trim() || null,
          location: editForm.location.trim() || null,
          year_delivery: isNaN(yearDelivNum as number) ? null : yearDelivNum,
          status: editForm.status || 'aktif',
          serial_number: editForm.serial_number.trim() || null,
          marketing_status: editForm.marketing_status || null,
          device_number: editForm.device_number.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', unit.id)
      if (error) throw error
      setIsEditingFull(false)
      setActionFeedback('Data unit berhasil diperbarui!')
      setTimeout(() => setActionFeedback(null), 3000)
      queryClient.invalidateQueries({ queryKey: ['units_page'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard_full_compliance_data'] })
    } catch (err: any) {
      setSaveError(err.message || 'Gagal menyimpan')
    } finally {
      setIsSavingUnit(false)
    }
  }

  const handleToggleProcess = async (field: string, currentVal?: string | null) => {
    if (!unit.vin) return
    const nextVal = currentVal === 'DONE' ? 'KOSONG' : 'DONE'
    await supabase.from('unit_process').upsert({ vin: unit.vin, [field]: nextVal }, { onConflict: 'vin' })
    queryClient.invalidateQueries({ queryKey: ['unit_process_detail', unit.vin] })
    setActionFeedback(`${field} → ${nextVal}`)
    setTimeout(() => setActionFeedback(null), 2500)
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'info', label: 'Ringkasan' },
    { id: 'oldp', label: 'OLDP', count: oldpRow ? 1 : 0 },
    { id: 'sales', label: 'Sales', count: salesRows.length },
    { id: 'sju', label: 'SJU', count: sjuRows.length },
    { id: 'wo', label: 'WO', count: woRows.length },
    { id: 'crm', label: 'CRM', count: crmRows.length },
    { id: 'process', label: 'Proses' },
    { id: 'documents', label: 'Dokumen', count: documentsData.length },
  ]

  const Field = ({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
    <div className="space-y-1">
      <span className="text-xs text-surface-500">{label}</span>
      <p className={`text-sm text-surface-200 ${mono ? 'font-mono' : 'font-medium'}`}>{value ?? '—'}</p>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-xl h-full bg-surface-950 border-l border-surface-800 shadow-2xl flex flex-col">
        <div className="p-4 border-b border-surface-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-accent truncate">{unit.vin || '—'}</p>
            <h3 className="text-lg font-bold text-surface-50 truncate">{unit.unit_number}</h3>
            <p className="text-xs text-surface-400">
              {unit.model || resolved.model || '—'} · SN {unit.serial_number || '—'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-surface-800 text-surface-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {actionFeedback && (
          <div className="mx-4 mt-3 p-2.5 rounded-lg bg-accent/15 border border-accent/30 text-xs text-accent flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            {actionFeedback}
          </div>
        )}

        <div className="flex gap-1 px-3 py-2 border-b border-surface-800 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'
              }`}
            >
              {t.label}
              {t.count != null && t.count > 0 ? ` (${t.count})` : ''}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-surface-700 bg-surface-900/60 p-3.5 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${oldpRow ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' : 'bg-surface-800 text-surface-500 border-surface-700'}`}>OLDP {oldpRow ? '✓' : '—'}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${salesRows.length ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-surface-800 text-surface-500 border-surface-700'}`}>Sales {salesRows.length || '—'}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${sjuRows.length ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' : 'bg-surface-800 text-surface-500 border-surface-700'}`}>SJU {sjuRows.length || '—'}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${woRows.length ? 'bg-violet-500/15 text-violet-400 border-violet-500/30' : 'bg-surface-800 text-surface-500 border-surface-700'}`}>WO {woRows.length || '—'}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${crmRows.length ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-surface-800 text-surface-500 border-surface-700'}`}>CRM {crmRows.length || '—'}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${marketingDerived === 'ITR' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'}`}>{marketingDerived}</span>
                </div>
                <ul className="text-[11px] text-surface-400 space-y-1 list-disc list-inside">
                  {cabangResolved.value && (
                    <li>
                      Under cabang resolved: <span className="text-violet-300 font-semibold">{cabangResolved.value}</span>
                      <span className="text-surface-500"> ({cabangResolved.source})</span>
                    </li>
                  )}
                  {oldpRow?.sales_date ? (
                    <li>
                      OLDP sales date: <span className="font-mono text-rose-200">{oldpRow.sales_date}</span>
                    </li>
                  ) : latestWoDate ? (
                    <li>
                      OLDP sales date kosong — saran pakai WO start date{' '}
                      <span className="font-mono text-surface-200">{latestWoDate}</span>
                    </li>
                  ) : null}
                  {oldpRow && unit.vin && oldpRow.vin !== unit.vin && (
                    <li className="text-amber-400">
                      OLDP match via VIN alternatif (<span className="font-mono">{oldpRow.vin}</span>)
                    </li>
                  )}
                  {marketingDerived === 'ITU' ? (
                    <li>VIN tidak ada di data penjualan → <strong className="text-amber-300">ITU</strong> (bukan ITR)</li>
                  ) : (
                    <li>VIN ketemu di data penjualan → <strong className="text-emerald-300">ITR</strong></li>
                  )}
                </ul>
                <p className="text-[10px] text-surface-500">Detail lengkap di tab OLDP · Sales · SJU · WO · CRM</p>
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={() => setIsEditingFull(!isEditingFull)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                  <Edit2 className="w-3.5 h-3.5" />
                  {isEditingFull ? 'Batal edit' : 'Edit unit'}
                </button>
              </div>

              {isEditingFull ? (
                <form onSubmit={handleSaveFullUnit} className="space-y-3 card p-4">
                  {saveError && (
                    <div className="text-xs text-red-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {saveError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      ['unit_number', 'No Unit'],
                      ['vin', 'VIN'],
                      ['model', 'Model'],
                      ['serial_number', 'Serial'],
                      ['under_cabang', 'Under cabang'],
                      ['customer', 'Customer'],
                      ['location', 'Lokasi'],
                      ['year_delivery', 'Tahun delivery'],
                      ['status', 'Status'],
                      ['marketing_status', 'Marketing'],
                      ['device_number', 'Device'],
                    ] as const).map(([key, label]) => (
                      <div key={key} className="space-y-1">
                        <label className="text-[11px] text-surface-400">{label}</label>
                        <input
                          className="input-field w-full text-sm"
                          value={(editForm as any)[key]}
                          onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                  <button type="submit" disabled={isSavingUnit} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
                    {isSavingUnit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Simpan
                  </button>
                </form>
              ) : (
                <div className="card p-4 grid grid-cols-2 gap-4">
                  <Field
                    label="VIN"
                    mono
                    value={
                      unit.vin ? (
                        <button type="button" className="inline-flex items-center gap-1 hover:text-accent" onClick={() => copyToClipboard(unit.vin!, 'vin')}>
                          {unit.vin}
                          {copiedField === 'vin' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      ) : (
                        '—'
                      )
                    }
                  />
                  <Field label="Model" value={unit.model || resolved.model} />
                  <Field label="Serial" value={unit.serial_number} mono />
                  <Field label="Status" value={unit.status} />
                  <Field label="Customer" value={unit.customer || unit.customer_update} />
                  <Field label="Lokasi" value={unit.location} />
                  <Field label="Under cabang (master)" value={unit.under_cabang} />
                  <Field
                    label="Under cabang (resolved)"
                    value={
                      <>
                        {cabangResolved.value || '—'}
                        <span className="block text-[10px] text-surface-500">{cabangResolved.source}</span>
                      </>
                    }
                  />
                  <Field label="Tahun delivery / BL" value={unit.year_delivery} />
                  <Field
                    label="Marketing"
                    value={
                      <span className="flex flex-wrap items-center gap-2">
                        <span>{unit.marketing_status || '—'}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${marketingDerived === 'ITR' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'}`}>
                          Derived: {marketingDerived}
                        </span>
                      </span>
                    }
                  />
                  {marketingMismatch && (
                    <p className="col-span-2 text-[10px] text-amber-400">
                      Nilai tersimpan beda dengan derived dari data penjualan ({marketingDerived}).
                    </p>
                  )}
                  <Field label="Stock status" value={unit.stock_status} />
                  <Field label="Device" value={unit.device_number} mono />
                  <Field label="BL" value={unit.bill_of_lading || unit.bl_date || oldpRow?.bl_date} />
                  {oldpRow && (
                    <>
                      <Field label="OLDP arrival" value={oldpRow.arrival_date} />
                      <Field label="OLDP PDI" value={oldpRow.pdi_date} />
                      <Field
                        label="OLDP sales date"
                        value={
                          oldpRow.sales_date || (
                            <span className="text-amber-400 text-xs">KOSONG</span>
                          )
                        }
                      />
                      <Field label="OLDP MS1 / MS2 / MS3" value={[oldpRow.ms1_date, oldpRow.ms2_date, oldpRow.ms3_date].filter(Boolean).join(' · ') || '—'} />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'oldp' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-rose-400" />
                <h4 className="text-sm font-bold">SDLG OLDP (Factory)</h4>
              </div>
              <OldpPanel row={oldpRow} matchedVin={unit.vin} />
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold">Data Penjualan</h4>
              </div>
              <SalesPanel rows={salesRows} />
            </div>
          )}
          {activeTab === 'sju' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Ship className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-bold">Data SJU / Pengiriman</h4>
              </div>
              <SjuPanel rows={sjuRows} />
            </div>
          )}
          {activeTab === 'wo' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-violet-400" />
                <h4 className="text-sm font-bold">Work Orders (AX)</h4>
              </div>
              <WoPanel rows={woRows} />
            </div>
          )}
          {activeTab === 'crm' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-bold">SDLG CRM</h4>
              </div>
              <CrmPanel rows={crmRows} />
            </div>
          )}

          {activeTab === 'process' && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold">Milestone proses</h4>
              {([
                ['arrival_check', 'Arrival'],
                ['pdi_check', 'PDI'],
                ['comm_check', 'Commissioning'],
                ['ms_check_1', 'MS1'],
                ['ms_check_2', 'MS2'],
                ['ms_check_3', 'MS3'],
              ] as const).map(([field, label]) => {
                const val = (processData as any)?.[field] as string | null | undefined
                const done = val === 'DONE'
                return (
                  <button
                    key={field}
                    type="button"
                    onClick={() => handleToggleProcess(field, val)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                      done
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-surface-900 border-surface-700 text-surface-400 hover:border-surface-600'
                    }`}
                  >
                    <span>{label}</span>
                    <span className="text-xs font-mono">{done ? 'DONE' : val || 'KOSONG'}</span>
                  </button>
                )
              })}
              {processData?.pdi_date && (
                <p className="text-xs text-surface-500">PDI date: {processData.pdi_date}</p>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold">Dokumen unit</h4>
              {documentsData.length === 0 && (
                <p className="text-xs text-surface-500">Belum ada dokumen terdaftar.</p>
              )}
              {documentsData.map((doc: any) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-surface-700 bg-surface-900/50 text-xs"
                >
                  <span className="text-surface-200">{doc.document_types?.name || doc.document_types?.code || 'Doc'}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded font-semibold ${
                      doc.status === 'uploaded'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : doc.status === 'missing'
                          ? 'bg-red-500/15 text-red-400'
                          : 'bg-surface-800 text-surface-400'
                    }`}
                  >
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-surface-800">
          <button type="button" onClick={onClose} className="btn-secondary w-full text-sm py-2">
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
