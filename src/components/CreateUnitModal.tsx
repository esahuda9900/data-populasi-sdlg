import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  X,
  Truck,
  Building,
  User,
  MapPin,
  Calendar,
  Hash,
  ShieldCheck,
  Tag,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { POPULAR_SDLG_MODELS, resolveUnitModel } from '../lib/modelUtils'

interface CreateUnitModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function CreateUnitModal({ isOpen, onClose, onSuccess }: CreateUnitModalProps) {
  const queryClient = useQueryClient()

  const [unitNumber, setUnitNumber] = useState('')
  const [vin, setVin] = useState('')
  const [model, setModel] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [cabang, setCabang] = useState('')
  const [customer, setCustomer] = useState('')
  const [location, setLocation] = useState('')
  const [yearDelivery, setYearDelivery] = useState<string>('2026')
  const [status, setStatus] = useState<string>('aktif')
  const [serialNumber, setSerialNumber] = useState('')
  const [marketingStatus, setMarketingStatus] = useState('Stock')
  const [deviceNumber, setDeviceNumber] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (!isOpen) return null

  // Auto-suggest model when unit number or VIN changes if model not yet manually chosen
  const handleUnitNumberChange = (val: string) => {
    setUnitNumber(val)
    if (!model || model === 'CUSTOM') {
      const resolved = resolveUnitModel({ unit_number: val, vin })
      if (resolved.isAutoInferred && resolved.model !== 'Perlu Dilengkapi') {
        if (POPULAR_SDLG_MODELS.includes(resolved.model)) {
          setModel(resolved.model)
        } else {
          setModel('CUSTOM')
          setCustomModel(resolved.model)
        }
      }
    }
  }

  const handleVinChange = (val: string) => {
    setVin(val)
    if (!model || model === 'CUSTOM') {
      const resolved = resolveUnitModel({ unit_number: unitNumber, vin: val })
      if (resolved.isAutoInferred && resolved.model !== 'Perlu Dilengkapi') {
        if (POPULAR_SDLG_MODELS.includes(resolved.model)) {
          setModel(resolved.model)
        } else {
          setModel('CUSTOM')
          setCustomModel(resolved.model)
        }
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!unitNumber.trim()) {
      setErrorMessage('Nomor Unit wajib diisi (Contoh: LG956L-01)')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const finalModel = model === 'CUSTOM' ? customModel.trim().toUpperCase() : model.trim().toUpperCase()
    const parsedYear = yearDelivery ? parseInt(yearDelivery, 10) : null

    try {
      // 1. Insert unit into units table
      const { data: newUnit, error: insertError } = await supabase
        .from('units')
        .insert({
          unit_number: unitNumber.trim().toUpperCase(),
          vin: vin.trim().toUpperCase() || null,
          model: finalModel || null,
          under_cabang: cabang.trim() || null,
          customer: customer.trim() || null,
          location: location.trim() || null,
          year_delivery: isNaN(parsedYear as number) ? null : parsedYear,
          status: status || 'aktif',
          serial_number: serialNumber.trim().toUpperCase() || null,
          marketing_status: marketingStatus.trim() || null,
          device_number: deviceNumber.trim() || null,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // 2. Initialize unit_process row if VIN or unitNumber is present
      if (newUnit) {
        await supabase.from('unit_process').upsert(
          {
            vin: newUnit.vin || newUnit.unit_number,
            unit_number: newUnit.unit_number,
            arrival_check: 'KOSONG',
            pdi_check: 'KOSONG',
            comm_check: 'KOSONG',
          },
          { onConflict: 'vin' }
        )
      }

      setSuccessMessage(`Unit ${unitNumber} berhasil ditambahkan ke database!`)

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['units_page'] })
      queryClient.invalidateQueries({ queryKey: ['units_count'] })
      queryClient.invalidateQueries({ queryKey: ['units_filtered_count'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard_full_compliance_data'] })
      queryClient.invalidateQueries({ queryKey: ['process_page_data'] })

      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 1500)
    } catch (err: any) {
      console.error('Error inserting unit:', err)
      setErrorMessage(err.message || 'Gagal menambahkan unit ke database.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isYear2026 = yearDelivery === '2026' || yearDelivery === '2026.0'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative bg-surface-900 border border-surface-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8 z-10">
        {/* Header */}
        <div className="p-5 border-b border-surface-800 bg-surface-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent/15 border border-accent/30 text-accent">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-surface-50">Tambah Unit Armada SDLG Baru</h3>
              <p className="text-xs text-surface-400">
                Registrasikan unit baru ke dalam database populasi dan pelacakan kepatuhan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback banners */}
        {errorMessage && (
          <div className="p-4 bg-red-500/10 border-b border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Unit Number */}
            <div className="space-y-1.5">
              <label className="font-semibold text-surface-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-accent" /> No. Unit <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: LG956L-JKT-01"
                value={unitNumber}
                onChange={(e) => handleUnitNumberChange(e.target.value)}
                required
                className="input w-full text-xs"
              />
              <span className="text-[10px] text-surface-500">Nomor lambung atau identifikasi unit di cabang</span>
            </div>

            {/* VIN / Rangka */}
            <div className="space-y-1.5">
              <label className="font-semibold text-surface-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-blue-400" /> VIN / No. Rangka
              </label>
              <input
                type="text"
                placeholder="Contoh: 9L00123456789"
                value={vin}
                onChange={(e) => handleVinChange(e.target.value)}
                className="input w-full text-xs font-mono"
              />
              <span className="text-[10px] text-surface-500">Nomor rangka pabrik (otomatis decode model)</span>
            </div>

            {/* Model Selection */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="font-semibold text-surface-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-400" /> Model Alat SDLG
              </label>
              <div className="flex gap-2">
                <select
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value)
                    if (e.target.value !== 'CUSTOM') setCustomModel('')
                  }}
                  className="input flex-1 text-xs"
                >
                  <option value="">-- Pilih Model Resmi SDLG --</option>
                  {POPULAR_SDLG_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value="CUSTOM">+ Tulis Model Lain (Custom)</option>
                </select>

                {model === 'CUSTOM' && (
                  <input
                    type="text"
                    placeholder="Contoh: LG956L / E6210F"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    className="input flex-1 text-xs"
                  />
                )}
              </div>
            </div>

            {/* Cabang */}
            <div className="space-y-1.5">
              <label className="font-semibold text-surface-300 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-400" /> Cabang Penanggung
              </label>
              <input
                type="text"
                placeholder="Contoh: Balikpapan / Jakarta / Surabaya"
                value={cabang}
                onChange={(e) => setCabang(e.target.value)}
                className="input w-full text-xs"
              />
            </div>

            {/* Customer */}
            <div className="space-y-1.5">
              <label className="font-semibold text-surface-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-400" /> Customer / Pembeli
              </label>
              <input
                type="text"
                placeholder="Contoh: PT Tambang Mandiri"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                className="input w-full text-xs"
              />
            </div>

            {/* Lokasi */}
            <div className="space-y-1.5">
              <label className="font-semibold text-surface-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-red-400" /> Lokasi Site / Workshop
              </label>
              <input
                type="text"
                placeholder="Contoh: Yard Marunda / Site Sangatta"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="input w-full text-xs"
              />
            </div>

            {/* Tahun Delivery / BL */}
            <div className="space-y-1.5">
              <label className="font-semibold text-surface-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-purple-400" /> Tahun Delivery / BL
                </span>
                {isYear2026 && (
                  <span className="text-[10px] text-red-400 font-bold bg-red-500/10 px-1.5 py-0.2 rounded border border-red-500/20">
                    Wajib Dokumen CSA
                  </span>
                )}
              </label>
              <input
                type="number"
                placeholder="Contoh: 2026"
                value={yearDelivery}
                onChange={(e) => setYearDelivery(e.target.value)}
                className="input w-full text-xs font-mono"
              />
              <span className="text-[10px] text-surface-500">
                {isYear2026
                  ? '⚠️ Unit impor 2026 wajib memiliki Customer Service Agreement (CSA)'
                  : 'Tahun Bill of Lading atau tanggal serah terima'}
              </span>
            </div>

            {/* Serial Number */}
            <div className="space-y-1.5">
              <label className="font-semibold text-surface-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-surface-400" /> Serial Number Pabrik
              </label>
              <input
                type="text"
                placeholder="Contoh: SN-956-8819"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="input w-full text-xs font-mono"
              />
            </div>

            {/* Status Operasional */}
            <div className="space-y-1.5">
              <label className="font-semibold text-surface-300">Status Unit</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input w-full text-xs"
              >
                <option value="aktif">aktif (Beroperasi)</option>
                <option value="idle">idle (Standby)</option>
                <option value="maintenance">maintenance (Perbaikan)</option>
                <option value="transit">transit (Dalam Pengiriman)</option>
              </select>
            </div>

            {/* Status Marketing */}
            <div className="space-y-1.5">
              <label className="font-semibold text-surface-300">Status Marketing</label>
              <select
                value={marketingStatus}
                onChange={(e) => setMarketingStatus(e.target.value)}
                className="input w-full text-xs"
              >
                <option value="Stock">Stock (Persediaan)</option>
                <option value="Sold">Sold (Terjual)</option>
                <option value="Rental">Rental (Sewa)</option>
                <option value="Demo">Demo (Uji Coba)</option>
              </select>
            </div>

            {/* Nomor Perangkat / Telematika */}
            <div className="space-y-1.5">
              <label className="font-semibold text-surface-300">Nomor Telematika / GPS</label>
              <input
                type="text"
                placeholder="Contoh: DEV-SDLG-88123"
                value={deviceNumber}
                onChange={(e) => setDeviceNumber(e.target.value)}
                className="input w-full text-xs font-mono"
              />
            </div>
          </div>

          {/* Footer Action */}
          <div className="pt-4 border-t border-surface-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-secondary px-4 py-2 text-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-5 py-2 text-xs flex items-center gap-1.5 font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan ke Database...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Daftarkan Unit Baru</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
