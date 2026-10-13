import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase, Unit } from '../lib/supabase'
import { parseAiUpdate } from '../lib/aiParseClient'
import {
  Sparkles,
  X,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Truck,
  RotateCcw,
  Bot,
  Zap,
  Check,
} from 'lucide-react'

interface AiUpdateModalProps {
  isOpen: boolean
  onClose: () => void
  contextUnits: Unit[]
  onUnitUpdated?: (unitNumber: string) => void
}

interface ParsedResult {
  targetIdentifier: string
  matchedUnitNumber: string | null
  matchedVin: string | null
  matchedUnitId: string | null
  confidence: 'high' | 'medium' | 'low'
  summaryExplanation: string
  unitUpdates: Record<string, any>
  processUpdates: Record<string, string>
  engine?: string
}

const QUICK_EXAMPLES = [
  'Unit LG956L-01 commisioning nya udah di kirim sama cabang balikpapan tanggal 12 okt, tandai COMM done',
  'Tolong update unit LG936L statusnya ubah ke maintenance di site Samarinda',
  'Unit EX-04 arrival check dan PDI nya udah selesai di pelabuhan Banjarmasin',
  'Pindahkan unit LG956L ke cabang Makassar dengan customer PT Bukit Asam tahun delivery 2026',
]

export default function AiUpdateModal({
  isOpen,
  onClose,
  contextUnits,
  onUnitUpdated,
}: AiUpdateModalProps) {
  const queryClient = useQueryClient()

  const [prompt, setPrompt] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<ParsedResult | null>(null)

  const [isExecuting, setIsExecuting] = useState(false)
  const [executeSuccess, setExecuteSuccess] = useState<string | null>(null)
  const [executeError, setExecuteError] = useState<string | null>(null)

  if (!isOpen) return null

  // Tries Express /api when available (local server); falls back to client rule-heuristic on GH Pages
  const handleParse = async () => {
    if (!prompt.trim()) return

    setIsParsing(true)
    setParseError(null)
    setParsedData(null)
    setExecuteSuccess(null)
    setExecuteError(null)

    try {
      const data = await parseAiUpdate(
        prompt,
        contextUnits.map((u) => ({
          id: u.id,
          unit_number: u.unit_number,
          vin: u.vin,
          model: u.model,
          under_cabang: u.under_cabang,
          customer: u.customer,
          location: u.location,
          status: u.status,
        }))
      )
      setParsedData(data as ParsedResult)
    } catch (err: any) {
      console.error('AI parse error:', err)
      setParseError(err.message || 'Gagal memproses teks dengan AI.')
    } finally {
      setIsParsing(false)
    }
  }

  const handleApplyChanges = async () => {
    if (!parsedData) return
    setIsExecuting(true)
    setExecuteError(null)
    setExecuteSuccess(null)

    try {
      let targetUnit: Unit | undefined
      if (parsedData.matchedUnitId) {
        targetUnit = contextUnits.find((u) => u.id === parsedData.matchedUnitId)
      }
      if (!targetUnit && parsedData.matchedUnitNumber) {
        targetUnit = contextUnits.find(
          (u) => u.unit_number.toLowerCase() === parsedData.matchedUnitNumber?.toLowerCase()
        )
      }
      if (!targetUnit && parsedData.matchedVin) {
        targetUnit = contextUnits.find(
          (u) => u.vin?.toLowerCase() === parsedData.matchedVin?.toLowerCase()
        )
      }
      if (!targetUnit && parsedData.targetIdentifier) {
        targetUnit = contextUnits.find(
          (u) =>
            u.unit_number.toLowerCase().includes(parsedData.targetIdentifier.toLowerCase()) ||
            (u.vin && u.vin.toLowerCase().includes(parsedData.targetIdentifier.toLowerCase()))
        )
      }

      if (!targetUnit) {
        const queryTerm = parsedData.matchedUnitNumber || parsedData.targetIdentifier
        const { data: dbUnit } = await supabase
          .from('units')
          .select('*')
          .or(`unit_number.ilike.%${queryTerm}%,vin.ilike.%${queryTerm}%`)
          .limit(1)
          .maybeSingle()

        if (dbUnit) {
          targetUnit = dbUnit
        }
      }

      if (!targetUnit) {
        throw new Error(
          `Unit "${parsedData.matchedUnitNumber || parsedData.targetIdentifier}" tidak ditemukan di database. Pastikan nomor unit atau VIN sudah benar.`
        )
      }

      if (parsedData.unitUpdates && Object.keys(parsedData.unitUpdates).length > 0) {
        const { error: unitErr } = await supabase
          .from('units')
          .update({
            ...parsedData.unitUpdates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetUnit.id)

        if (unitErr) throw unitErr
      }

      if (parsedData.processUpdates && Object.keys(parsedData.processUpdates).length > 0) {
        const targetVin = targetUnit.vin || targetUnit.unit_number
        const { error: procErr } = await supabase.from('unit_process').upsert(
          {
            vin: targetVin,
            ...parsedData.processUpdates,
          },
          { onConflict: 'vin' }
        )

        if (procErr) throw procErr
      }

      queryClient.invalidateQueries({ queryKey: ['units_page'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard_full_compliance_data'] })
      queryClient.invalidateQueries({ queryKey: ['process_page_data'] })
      queryClient.invalidateQueries({ queryKey: ['unit_process_detail', targetUnit.vin] })

      setExecuteSuccess(
        `Berhasil! Data unit ${targetUnit.unit_number} telah berhasil diperbarui sesuai instruksi AI.`
      )

      if (onUnitUpdated) {
        onUnitUpdated(targetUnit.unit_number)
      }
    } catch (err: any) {
      console.error('Execution error:', err)
      setExecuteError(err.message || 'Gagal menerapkan perubahan ke database.')
    } finally {
      setIsExecuting(false)
    }
  }

  const handleReset = () => {
    setParsedData(null)
    setParseError(null)
    setExecuteSuccess(null)
    setExecuteError(null)
  }

  const matchedUnitInContext = parsedData
    ? contextUnits.find(
        (u) =>
          u.id === parsedData.matchedUnitId ||
          u.unit_number.toLowerCase() === parsedData.matchedUnitNumber?.toLowerCase() ||
          (u.vin && u.vin.toLowerCase() === parsedData.matchedVin?.toLowerCase())
      )
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-5 border-b border-surface-800 flex items-center justify-between bg-gradient-to-r from-surface-950 via-surface-900 to-accent/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shadow-sm">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-surface-50">AI Smart Unit Updater</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/20 text-accent border border-accent/30 flex items-center gap-1">
                  <Bot className="w-3 h-3" /> Asisten Lapangan
                </span>
              </div>
              <p className="text-xs text-surface-400">
                Tulis instruksi dalam bahasa santai atau laporan WhatsApp, AI otomatis memetakan dan mengupdate unit.
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

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {executeSuccess && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start justify-between gap-3 animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm text-emerald-300">Pembaruan Berhasil Diterapkan!</p>
                  <p className="text-emerald-400/90 mt-0.5">{executeSuccess}</p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="btn-secondary text-[11px] px-2.5 py-1 text-surface-200 shrink-0"
              >
                Update Unit Lain
              </button>
            </div>
          )}

          {!parsedData && (
            <div className="space-y-1.5">
              <span className="text-[11px] text-surface-400 font-medium flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-accent" /> Contoh Perintah Cepat (Klik untuk coba):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_EXAMPLES.map((ex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(ex)}
                    className="text-left text-[11px] px-2.5 py-1.5 rounded-lg bg-surface-950/70 border border-surface-800 hover:border-accent/40 text-surface-300 hover:text-surface-100 transition-colors"
                  >
                    "{ex}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {!parsedData && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-surface-300 flex items-center justify-between">
                <span>Instruksi Update Bahasa Alami:</span>
                <span className="text-[10px] text-surface-500 font-mono">
                  Bebas menyebut No Unit, Cabang, COMM, PDI, Lokasi, dll.
                </span>
              </label>
              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Contoh: Unit LG956L-03 commisioning nya udah di kirim sama cabang Balikpapan kemarin, tolong status COMM diubah jadi selesai dan lokasinya sekarang di Yard Kariangau..."
                className="input-field w-full text-xs font-sans leading-relaxed resize-none"
              />

              {parseError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-surface-500">
                  {contextUnits.length} unit tersedia di memori konteks
                </span>
                <button
                  type="button"
                  onClick={handleParse}
                  disabled={isParsing || !prompt.trim()}
                  className="btn-primary text-xs px-5 py-2 flex items-center gap-2 font-semibold shadow-lg shadow-accent/15"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Memproses dengan AI...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Analisa & Parsing dengan AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {parsedData && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-xl bg-surface-950 border border-surface-800 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-accent tracking-wider">
                      Unit Terdeteksi:
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                        parsedData.confidence === 'high'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : parsedData.confidence === 'medium'
                          ? 'bg-amber-400/20 text-amber-400'
                          : 'bg-red-400/20 text-red-400'
                      }`}
                    >
                      Confidence: {parsedData.confidence.toUpperCase()}
                    </span>
                    {parsedData.engine && (
                      <span className="text-[10px] text-surface-500">({parsedData.engine})</span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-surface-100 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-accent" />
                    <span>{parsedData.matchedUnitNumber || parsedData.targetIdentifier}</span>
                    {matchedUnitInContext && (
                      <span className="text-xs font-normal text-surface-400">
                        • {matchedUnitInContext.model || 'Model'} • Cabang{' '}
                        {matchedUnitInContext.under_cabang || '—'}
                      </span>
                    )}
                  </h4>
                  {parsedData.matchedVin && (
                    <p className="text-xs font-mono text-surface-400">VIN: {parsedData.matchedVin}</p>
                  )}
                </div>

                <button
                  onClick={handleReset}
                  className="btn-secondary text-[11px] px-2 py-1 flex items-center gap-1 text-surface-400 hover:text-surface-200"
                  title="Ketik ulang instruksi"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Ubah Teks</span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-accent/5 border border-accent/20 space-y-1">
                <span className="text-[11px] font-bold text-accent flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5" /> Hasil Ekstraksi AI:
                </span>
                <p className="text-xs text-surface-200">{parsedData.summaryExplanation}</p>
              </div>

              <div className="space-y-3">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-surface-400">
                  Daftar Perubahan yang Akan Diterapkan ke Database:
                </h5>

                {parsedData.processUpdates && Object.keys(parsedData.processUpdates).length > 0 && (
                  <div className="card p-3.5 space-y-2 bg-surface-950/60">
                    <span className="text-xs font-bold text-surface-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" /> Tahapan Proses (unit_process)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {Object.entries(parsedData.processUpdates).map(([key, val]) => (
                        <div
                          key={key}
                          className="p-2 rounded-lg bg-surface-900 border border-surface-800 flex items-center justify-between"
                        >
                          <span className="text-surface-400 capitalize">
                            {key.replace('_check', '').toUpperCase()} Check:
                          </span>
                          <span className="font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                            ➔ {val}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {parsedData.unitUpdates && Object.keys(parsedData.unitUpdates).length > 0 && (
                  <div className="card p-3.5 space-y-2 bg-surface-950/60">
                    <span className="text-xs font-bold text-surface-300 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-accent" /> Data Spesifikasi Armada (units)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {Object.entries(parsedData.unitUpdates).map(([key, val]) => (
                        <div
                          key={key}
                          className="p-2 rounded-lg bg-surface-900 border border-surface-800 flex items-center justify-between gap-2"
                        >
                          <span className="text-surface-400 capitalize">{key.replace('_', ' ')}:</span>
                          <span className="font-bold text-accent truncate">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(parsedData.processUpdates || {}).length === 0 &&
                  Object.keys(parsedData.unitUpdates || {}).length === 0 && (
                    <div className="p-3 bg-amber-400/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
                      Tidak ada perubahan spesifik yang berhasil dipetakan dari kalimat Anda. Silakan coba
                      perintah yang lebih jelas.
                    </div>
                  )}
              </div>

              {executeError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{executeError}</span>
                </div>
              )}

              <div className="pt-2 border-t border-surface-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isExecuting}
                  className="btn-secondary px-4 py-2 text-xs"
                >
                  Ubah Teks
                </button>
                <button
                  type="button"
                  onClick={handleApplyChanges}
                  disabled={isExecuting}
                  className="btn-primary px-5 py-2 text-xs flex items-center gap-2 font-bold shadow-lg shadow-accent/20"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan ke Database...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Terapkan Perubahan ke Database</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-surface-950 border-t border-surface-800 text-[11px] text-surface-500 flex items-center justify-between px-5">
          <span>SDLG AI Natural Language Pipeline v2.5</span>
          <button onClick={onClose} className="hover:text-surface-300">
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
