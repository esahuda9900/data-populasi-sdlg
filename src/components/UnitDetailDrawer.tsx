import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, Unit, UnitProcess } from '../lib/supabase'
import {
  X,
  Truck,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Calendar,
  MapPin,
  Building,
  User,
  ShieldCheck,
  Tag,
  Hash,
  Edit2,
  Sparkles,
  Save,
  Loader2,
} from 'lucide-react'
import { resolveUnitModel, POPULAR_SDLG_MODELS } from '../lib/modelUtils'

interface UnitDetailDrawerProps {
  unit: Unit | null
  onClose: () => void
}

export default function UnitDetailDrawer({ unit, onClose }: UnitDetailDrawerProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'info' | 'process' | 'documents'>('info')
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Model edit state
  const [isEditingModel, setIsEditingModel] = useState(false)
  const [selectedModel, setSelectedModel] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [isSavingModel, setIsSavingModel] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Current resolved model
  const resolved = resolveUnitModel(unit)

  useEffect(() => {
    if (unit) {
      setSelectedModel(unit.model || resolved.model || '')
      setCustomModel('')
      setIsEditingModel(false)
      setSaveSuccess(false)
      setSaveError(null)
    }
  }, [unit])

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Fetch unit process
  const { data: processData, isLoading: loadingProcess } = useQuery<UnitProcess | null>({
    queryKey: ['unit_process_detail', unit?.vin],
    queryFn: async () => {
      if (!unit?.vin) return null
      const { data } = await supabase
        .from('unit_process')
        .select('*')
        .eq('vin', unit.vin)
        .maybeSingle()
      return (data as UnitProcess) || null
    },
    enabled: !!unit?.vin,
  })

  // Fetch unit documents
  const { data: documentsData = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['unit_docs_detail', unit?.id],
    queryFn: async () => {
      if (!unit?.id) return []
      const { data } = await supabase
        .from('unit_documents')
        .select(`
          id,
          status,
          file_name,
          file_url,
          uploaded_at,
          notes,
          document_types (name, code, is_required)
        `)
        .eq('unit_id', unit.id)
      return data || []
    },
    enabled: !!unit?.id,
  })

  if (!unit) return null

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleSaveModel = async (modelToSave: string) => {
    if (!modelToSave.trim() || !unit?.id) return
    setIsSavingModel(true)
    setSaveError(null)

    try {
      const finalModel = modelToSave.trim().toUpperCase()
      const { error } = await supabase
        .from('units')
        .update({ model: finalModel })
        .eq('id', unit.id)

      if (error) throw error

      // Update local unit object
      unit.model = finalModel
      setIsEditingModel(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)

      // Invalidate queries across the app
      queryClient.invalidateQueries({ queryKey: ['units_page'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] })
      queryClient.invalidateQueries({ queryKey: ['process_page_data'] })
      queryClient.invalidateQueries({ queryKey: ['docs_page_data'] })
    } catch (err: any) {
      console.error('Failed to update unit model:', err)
      setSaveError(err.message || 'Gagal menyimpan perubahan ke database')
    } finally {
      setIsSavingModel(false)
    }
  }

  const renderBadge = (statusVal?: string | null) => {
    if (!statusVal || statusVal === 'KOSONG') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-400/15 text-red-400 border border-red-500/30">
          <XCircle className="w-3.5 h-3.5" /> KOSONG
        </span>
      )
    }
    if (statusVal === 'DONE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" /> DONE
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-400/15 text-amber-400 border border-amber-500/30">
        <AlertCircle className="w-3.5 h-3.5" /> {statusVal}
      </span>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-surface-900 border-l border-surface-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-surface-800 bg-surface-950/60 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-accent">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-surface-50">
                    {unit.unit_number || 'Unit Tanpa Nomor'}
                  </h3>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider ${
                      unit.status === 'aktif'
                        ? 'bg-accent/15 text-accent'
                        : unit.status === 'idle'
                        ? 'bg-amber-400/15 text-amber-400'
                        : 'bg-surface-800 text-surface-400'
                    }`}
                  >
                    {unit.status || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono text-surface-400">{unit.vin || 'VIN: —'}</span>
                  {unit.vin && (
                    <button
                      onClick={() => copyToClipboard(unit.vin!, 'vin')}
                      className="text-surface-500 hover:text-surface-300 transition-colors p-0.5"
                      title="Salin VIN"
                    >
                      {copiedField === 'vin' ? (
                        <Check className="w-3.5 h-3.5 text-accent" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-surface-800 px-6 gap-6 bg-surface-900/50">
            <button
              onClick={() => setActiveTab('info')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'info'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-surface-400 hover:text-surface-200'
              }`}
            >
              Informasi Unit
            </button>
            <button
              onClick={() => setActiveTab('process')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'process'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-surface-400 hover:text-surface-200'
              }`}
            >
              Pemeriksaan Proses
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'documents'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-surface-400 hover:text-surface-200'
              }`}
            >
              Dokumen Unit
              {documentsData.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-surface-800 text-surface-300 font-mono">
                  {documentsData.length}
                </span>
              )}
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === 'info' && (
              <div className="space-y-6">
                {/* Model & Branch Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Model Alat Card */}
                  <div className="card p-4 space-y-2 bg-surface-950/40 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-surface-400 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-accent" /> Model Alat
                      </span>
                      <button
                        onClick={() => setIsEditingModel(!isEditingModel)}
                        className="text-[11px] text-accent hover:underline flex items-center gap-1"
                        title="Perbarui model unit"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>{isEditingModel ? 'Batal' : 'Ubah Model'}</span>
                      </button>
                    </div>

                    {!isEditingModel ? (
                      <div>
                        <div className="flex items-baseline gap-2">
                          <p className="text-lg font-bold text-surface-100">
                            {unit.model || resolved.model}
                          </p>
                          {resolved.isAutoInferred && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" /> Terdeteksi otomatis
                            </span>
                          )}
                        </div>

                        {/* Suggestion to permanently save auto-inferred model */}
                        {resolved.isAutoInferred && resolved.model !== 'Perlu Dilengkapi' && !unit.model && (
                          <div className="mt-2 pt-2 border-t border-surface-800/80 flex items-center justify-between">
                            <span className="text-[11px] text-surface-400">
                              Simpan model {resolved.model} ke DB?
                            </span>
                            <button
                              onClick={() => handleSaveModel(resolved.model)}
                              disabled={isSavingModel}
                              className="px-2 py-0.5 rounded bg-accent/20 hover:bg-accent/30 text-accent text-[11px] font-semibold transition-colors flex items-center gap-1"
                            >
                              {isSavingModel ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Save className="w-3 h-3" />
                              )}
                              Simpan
                            </button>
                          </div>
                        )}

                        <p className="text-xs text-surface-500 mt-1">
                          Varian: {unit.variant || unit.group_type || 'Standard'}
                        </p>
                      </div>
                    ) : (
                      /* Inline Model Editor */
                      <div className="space-y-2 pt-1 border-t border-surface-800">
                        <label className="text-[11px] text-surface-400 block">Pilih Model Resmi SDLG:</label>
                        <select
                          value={selectedModel}
                          onChange={(e) => {
                            setSelectedModel(e.target.value)
                            if (e.target.value !== 'CUSTOM') setCustomModel('')
                          }}
                          className="input text-xs py-1.5"
                        >
                          <option value="">-- Pilih Model --</option>
                          {POPULAR_SDLG_MODELS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                          <option value="CUSTOM">+ Tulis Model Lain</option>
                        </select>

                        {selectedModel === 'CUSTOM' && (
                          <input
                            type="text"
                            placeholder="Contoh: LG956L / E6210F"
                            value={customModel}
                            onChange={(e) => setCustomModel(e.target.value)}
                            className="input text-xs py-1.5"
                          />
                        )}

                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() =>
                              handleSaveModel(
                                selectedModel === 'CUSTOM' ? customModel : selectedModel
                              )
                            }
                            disabled={
                              isSavingModel ||
                              (!selectedModel && !customModel) ||
                              (selectedModel === 'CUSTOM' && !customModel.trim())
                            }
                            className="btn-primary text-xs py-1 px-3 flex items-center gap-1 flex-1 justify-center disabled:opacity-50"
                          >
                            {isSavingModel ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Save className="w-3 h-3" />
                            )}
                            Simpan ke DB
                          </button>
                          <button
                            onClick={() => setIsEditingModel(false)}
                            className="btn-secondary text-xs py-1 px-2"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    )}

                    {saveSuccess && (
                      <p className="text-[11px] text-accent flex items-center gap-1 font-semibold">
                        <Check className="w-3 h-3" /> Model berhasil disimpan ke database!
                      </p>
                    )}
                    {saveError && (
                      <p className="text-[11px] text-red-400">{saveError}</p>
                    )}
                  </div>

                  {/* Cabang Card */}
                  <div className="card p-4 space-y-1 bg-surface-950/40">
                    <span className="text-xs text-surface-400 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-blue-400" /> Cabang Penanggung
                    </span>
                    <p className="text-base font-semibold text-surface-100">
                      {unit.under_cabang || '—'}
                    </p>
                    <p className="text-xs text-surface-500">Regional Branch Operasional</p>
                  </div>
                </div>

                {/* Detail Operasional & Kepemilikan */}
                <div className="card p-4 space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-400">
                    Detail Operasional & Kepemilikan
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-xs text-surface-500 flex items-center gap-1">
                        <User className="w-3 h-3" /> Customer / Pembeli
                      </span>
                      <p className="font-medium text-surface-200">{unit.customer || '—'}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs text-surface-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Lokasi Terkini
                      </span>
                      <p className="font-medium text-surface-200">{unit.location || '—'}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs text-surface-500 flex items-center gap-1">
                        <Hash className="w-3 h-3" /> Serial Number
                      </span>
                      <p className="font-mono text-surface-200">{unit.serial_number || '—'}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs text-surface-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Tahun Delivery
                      </span>
                      <p className="font-medium text-surface-200">{unit.year_delivery || '—'}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs text-surface-500">Status Marketing</span>
                      <p className="font-medium text-surface-200">{unit.marketing_status || '—'}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs text-surface-500">Status Stock</span>
                      <p className="font-medium text-surface-200">{unit.stock_status || '—'}</p>
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-xs text-surface-500">Nomor Perangkat (Telematika / Device)</span>
                      <p className="font-mono text-xs text-surface-300 bg-surface-800/60 p-2 rounded-lg">
                        {unit.device_number || 'Tidak terpasang telematika'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'process' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-surface-950/40 border border-surface-800">
                  <h4 className="text-sm font-semibold text-surface-200 mb-1">
                    Tahapan Kesiapan Unit SDLG
                  </h4>
                  <p className="text-xs text-surface-400">
                    Proses verifikasi dari kedatangan hingga siap diserahkan ke pelanggan.
                  </p>
                </div>

                {loadingProcess ? (
                  <div className="space-y-3">
                    <div className="h-20 bg-surface-800/60 rounded-xl animate-pulse" />
                    <div className="h-20 bg-surface-800/60 rounded-xl animate-pulse" />
                    <div className="h-20 bg-surface-800/60 rounded-xl animate-pulse" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="card p-4 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-400" />
                          <h5 className="text-sm font-medium text-surface-100">1. Arrival Check</h5>
                        </div>
                        <p className="text-xs text-surface-400">
                          Pengecekan fisik awal kedatangan unit di gudang/cabang.
                        </p>
                      </div>
                      {renderBadge(processData?.arrival_check)}
                    </div>

                    <div className="card p-4 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          <h5 className="text-sm font-medium text-surface-100">2. Pre-Delivery Inspection (PDI)</h5>
                        </div>
                        <p className="text-xs text-surface-400">
                          Inspeksi mekanikal, fluida, kelistrikan & perlengkapan unit.
                        </p>
                      </div>
                      {renderBadge(processData?.pdi_check)}
                    </div>

                    <div className="card p-4 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <h5 className="text-sm font-medium text-surface-100">3. Commissioning (COMM)</h5>
                        </div>
                        <p className="text-xs text-surface-400">
                          Uji jalan, kalibrasi sistem kerja & serah terima operasional.
                        </p>
                      </div>
                      {renderBadge(processData?.comm_check)}
                    </div>

                    {/* Maintenance Stock 1, 2, 3 Card */}
                    <div className="card p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-medium text-surface-100 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-purple-400" />
                          Maintenance Stock (MS 1, 2, 3)
                        </h5>
                        <span className="text-xs text-surface-400">Periodic Stock Maintenance</span>
                      </div>
                      <p className="text-xs text-surface-400">
                        Pemeliharaan rutin unit alat berat selama masa stock penyimpanan di yard/gudang.
                      </p>
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div className="p-2.5 rounded-lg bg-surface-950/60 border border-surface-800 text-center">
                          <span className="text-[11px] text-surface-400 block mb-1">MS 1 (30 Hari)</span>
                          {renderBadge((processData as any)?.ms1_check || (processData as any)?.ms_1)}
                        </div>
                        <div className="p-2.5 rounded-lg bg-surface-950/60 border border-surface-800 text-center">
                          <span className="text-[11px] text-surface-400 block mb-1">MS 2 (60 Hari)</span>
                          {renderBadge((processData as any)?.ms2_check || (processData as any)?.ms_2)}
                        </div>
                        <div className="p-2.5 rounded-lg bg-surface-950/60 border border-surface-800 text-center">
                          <span className="text-[11px] text-surface-400 block mb-1">MS 3 (90 Hari)</span>
                          {renderBadge((processData as any)?.ms3_check || (processData as any)?.ms_3)}
                        </div>
                      </div>
                    </div>

                    {/* Customer Service Agreement (CSA) Card */}
                    <div className={`card p-4 space-y-2 ${
                      unit.year_delivery === 2026 ? 'border-red-500/30 bg-red-500/5' : ''
                    }`}>
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-medium text-surface-100 flex items-center gap-2">
                          <ShieldCheck className={`w-4 h-4 ${unit.year_delivery === 2026 ? 'text-red-400' : 'text-accent'}`} />
                          Customer Service Agreement (CSA)
                        </h5>
                        {unit.year_delivery === 2026 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                            Wajib Impor 2026
                          </span>
                        ) : (
                          <span className="text-xs text-surface-500">Opsional Non-2026</span>
                        )}
                      </div>
                      <p className="text-xs text-surface-400">
                        {unit.year_delivery === 2026
                          ? 'Peraturan Operasional: Unit dengan delivery/BL 2026 wajib memiliki kontrak Customer Service Agreement.'
                          : 'Perjanjian kontrak layanan perawatan unit berkala bersama customer.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-surface-950/40 border border-surface-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-surface-200">Berkas & Legalitas</h4>
                    <p className="text-xs text-surface-400">Status kelengkapan dokumen untuk unit ini.</p>
                  </div>
                  <ShieldCheck className="w-5 h-5 text-accent" />
                </div>

                {/* Import 2026 CSA Alert */}
                {unit.year_delivery === 2026 && (
                  <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-red-300">
                        Aturan Wajib Impor 2026: Customer Service Agreement (CSA)
                      </p>
                      <p className="text-[11px] text-surface-300 mt-0.5">
                        Unit ini memiliki tanggal delivery/BL tahun 2026. Pastikan dokumen CSA telah ditandatangani dan diunggah.
                      </p>
                    </div>
                  </div>
                )}

                {loadingDocs ? (
                  <div className="space-y-3">
                    <div className="h-16 bg-surface-800/60 rounded-xl animate-pulse" />
                    <div className="h-16 bg-surface-800/60 rounded-xl animate-pulse" />
                  </div>
                ) : documentsData.length === 0 ? (
                  <div className="card text-center py-8">
                    <FileText className="w-8 h-8 text-surface-600 mx-auto mb-2" />
                    <p className="text-sm text-surface-300">Belum ada daftar dokumen terhubung.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documentsData.map((doc: any) => {
                      const isMissing = doc.status === 'missing' || doc.status === 'pending'
                      return (
                        <div
                          key={doc.id}
                          className="card p-3 flex items-center justify-between gap-3 hover:bg-surface-800/40 transition-colors"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-surface-100">
                                {doc.document_types?.name || 'Dokumen'}
                              </span>
                              {doc.document_types?.is_required && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-400/10 text-red-400 border border-red-500/20 font-semibold">
                                  Wajib
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-surface-400">
                              {doc.file_name ? doc.file_name : 'Belum diunggah'}
                            </p>
                          </div>

                          <div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                !isMissing
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : 'bg-red-400/15 text-red-400'
                              }`}
                            >
                              {doc.status}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="p-4 border-t border-surface-800 bg-surface-950/40 flex items-center justify-between">
            <span className="text-xs text-surface-500">ID: {unit.id}</span>
            <button
              onClick={onClose}
              className="btn-secondary px-4 py-1.5 text-xs font-medium"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
