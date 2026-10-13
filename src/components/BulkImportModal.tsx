import { useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  Upload,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
  Loader2,
  ArrowRight,
  Database,
} from 'lucide-react'
import { resolveUnitModel } from '../lib/modelUtils'

interface BulkImportModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ParsedUnitRow {
  unit_number: string
  vin: string
  model: string
  under_cabang: string
  customer: string
  location: string
  year_delivery: number | null
  status: string
  serial_number: string
  marketing_status: string
  isValid: boolean
  validationError?: string
}

export default function BulkImportModal({ isOpen, onClose }: BulkImportModalProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedUnitRow[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [importProgress, setImportProgress] = useState<number | null>(null)
  const [importResult, setImportResult] = useState<{
    successCount: number
    failedCount: number
  } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const handleDownloadTemplate = () => {
    const headers = [
      'unit_number',
      'vin',
      'model',
      'under_cabang',
      'customer',
      'location',
      'year_delivery',
      'status',
      'serial_number',
      'marketing_status',
    ]
    const sampleRows = [
      [
        'LG956L-JKT-01',
        '9L0012345678901',
        'LG956L',
        'Jakarta',
        'PT Tambang Abadi',
        'Site Marunda',
        '2026',
        'aktif',
        'SN-956-001',
        'Sold',
      ],
      [
        'E6210F-SBY-02',
        '9L0098765432102',
        'E6210F',
        'Surabaya',
        'CV Konstruksi Mandiri',
        'Workshop Gresik',
        '2025',
        'aktif',
        'SN-6210-002',
        'Rental',
      ],
      [
        'G9190-BPN-03',
        '9L0055443322103',
        'G9190',
        'Balikpapan',
        'PT Borneo Mining',
        'Yard Sepinggan',
        '2026',
        'idle',
        'SN-9190-003',
        'Stock',
      ],
    ]

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'Format_Import_Armada_SDLG.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length < 2) {
      setErrorMessage('Berkas CSV kosong atau tidak memiliki baris data.')
      return
    }

    const headerLine = lines[0]
    const headers = headerLine
      .split(',')
      .map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase())

    const getColIndex = (names: string[]) => {
      for (const name of names) {
        const idx = headers.indexOf(name)
        if (idx !== -1) return idx
      }
      return -1
    }

    const idxUnitNo = getColIndex(['unit_number', 'no_unit', 'unit number', 'no unit', 'unit'])
    const idxVin = getColIndex(['vin', 'chassis', 'no_rangka', 'no rangka'])
    const idxModel = getColIndex(['model', 'tipe', 'type', 'model_alat'])
    const idxCabang = getColIndex(['under_cabang', 'cabang', 'branch', 'wilayah'])
    const idxCustomer = getColIndex(['customer', 'pelanggan', 'client', 'pembeli'])
    const idxLocation = getColIndex(['location', 'lokasi', 'site', 'posisi'])
    const idxYear = getColIndex(['year_delivery', 'tahun', 'year', 'tahun_delivery', 'tahun_bl', 'bl'])
    const idxStatus = getColIndex(['status', 'unit_status', 'kondisi'])
    const idxSerial = getColIndex(['serial_number', 'serial', 'sn', 'no_seri'])
    const idxMarketing = getColIndex(['marketing_status', 'marketing', 'status_marketing'])

    const rows: ParsedUnitRow[] = []

    for (let i = 1; i < lines.length; i++) {
      // Regex CSV splitter respecting quotes
      const match = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
      const values = lines[i]
        .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        .map((v) => v.replace(/^["']|["']$/g, '').trim())

      if (values.length === 0 || (values.length === 1 && !values[0])) continue

      const unitNo = idxUnitNo !== -1 ? values[idxUnitNo] || '' : values[0] || ''
      const vin = idxVin !== -1 ? values[idxVin] || '' : values[1] || ''
      let rawModel = idxModel !== -1 ? values[idxModel] || '' : ''
      const cabang = idxCabang !== -1 ? values[idxCabang] || 'Head Office' : 'Head Office'
      const customer = idxCustomer !== -1 ? values[idxCustomer] || '' : ''
      const location = idxLocation !== -1 ? values[idxLocation] || '' : ''
      const yearStr = idxYear !== -1 ? values[idxYear] || '' : ''
      const status = idxStatus !== -1 ? values[idxStatus] || 'aktif' : 'aktif'
      const serial = idxSerial !== -1 ? values[idxSerial] || '' : ''
      const marketing = idxMarketing !== -1 ? values[idxMarketing] || '' : ''

      let year: number | null = null
      if (yearStr) {
        const parsedYear = parseInt(yearStr.replace(/[^0-9]/g, ''), 10)
        if (!isNaN(parsedYear) && parsedYear > 1990 && parsedYear < 2050) {
          year = parsedYear
        }
      }

      // Check if model needs resolution
      const resolved = resolveUnitModel({
        unit_number: unitNo,
        vin,
        model: rawModel,
      })
      const finalModel = rawModel || (resolved.model !== 'Perlu Dilengkapi' ? resolved.model : '')

      let isValid = true
      let validationError = ''

      if (!unitNo && !vin) {
        isValid = false
        validationError = 'Wajib memiliki No Unit atau VIN'
      }

      rows.push({
        unit_number: unitNo || vin,
        vin: vin || unitNo,
        model: finalModel,
        under_cabang: cabang,
        customer,
        location,
        year_delivery: year,
        status: status.toLowerCase() === 'idle' ? 'idle' : 'aktif',
        serial_number: serial,
        marketing_status: marketing,
        isValid,
        validationError,
      })
    }

    setParsedRows(rows)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setErrorMessage(null)
    setImportResult(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (text) parseCSV(text)
    }
    reader.onerror = () => {
      setErrorMessage('Gagal membaca berkas CSV.')
    }
    reader.readAsText(selectedFile)
  }

  const handleCommitImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid)
    if (validRows.length === 0) return

    setIsProcessing(true)
    setErrorMessage(null)
    let success = 0
    let failed = 0

    const BATCH_SIZE = 50
    const totalBatches = Math.ceil(validRows.length / BATCH_SIZE)

    try {
      for (let b = 0; b < totalBatches; b++) {
        setImportProgress(Math.round(((b + 1) / totalBatches) * 100))
        const batch = validRows.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE)

        const insertPayload = batch.map((r) => ({
          unit_number: r.unit_number,
          vin: r.vin,
          model: r.model || null,
          under_cabang: r.under_cabang,
          customer: r.customer || null,
          location: r.location || null,
          year_delivery: r.year_delivery,
          status: r.status,
          serial_number: r.serial_number || null,
          marketing_status: r.marketing_status || null,
        }))

        // Insert into units
        const { data: insertedUnits, error: unitErr } = await supabase
          .from('units')
          .upsert(insertPayload, { onConflict: 'vin' })
          .select('id, vin')

        if (unitErr) {
          console.error('Batch insert error:', unitErr)
          failed += batch.length
        } else {
          success += batch.length

          // Ensure unit_process exists for these VINs
          const procPayload = batch
            .filter((r) => r.vin)
            .map((r) => ({
              vin: r.vin,
              arrival_check: 'KOSONG',
              pdi_check: 'KOSONG',
              comm_check: 'KOSONG',
            }))

          if (procPayload.length > 0) {
            await supabase
              .from('unit_process')
              .upsert(procPayload, { onConflict: 'vin' })
          }
        }
      }

      setImportResult({ successCount: success, failedCount: failed })

      // Invalidate queries across the app
      queryClient.invalidateQueries({ queryKey: ['units_page'] })
      queryClient.invalidateQueries({ queryKey: ['units_count'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard_full_compliance_data'] })
      queryClient.invalidateQueries({ queryKey: ['process_page_data'] })
      queryClient.invalidateQueries({ queryKey: ['docs_page_data'] })
    } catch (err: any) {
      console.error('Fatal import error:', err)
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat menyimpan ke database.')
    } finally {
      setIsProcessing(false)
      setImportProgress(null)
    }
  }

  const resetAll = () => {
    setFile(null)
    setParsedRows([])
    setImportResult(null)
    setErrorMessage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const validCount = parsedRows.filter((r) => r.isValid).length
  const invalidCount = parsedRows.filter((r) => !r.isValid).length

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="min-h-full flex items-center justify-center p-4">
        <div className="card w-full max-w-4xl bg-surface-900 border border-surface-800 shadow-2xl relative z-10 p-6 space-y-6 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-surface-800">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-accent/15 border border-accent/30 text-accent">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-surface-50">
                  Bulk Import Data Armada SDLG
                </h3>
                <p className="text-xs text-surface-400 mt-0.5">
                  Unggah berkas CSV untuk mengimpor dan memperbarui puluhan hingga ratusan unit sekaligus
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

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto space-y-6 pr-1">
            {/* Template Download Banner */}
            <div className="p-4 rounded-xl bg-surface-950/70 border border-surface-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-semibold text-surface-200">
                  Belum punya format CSV yang sesuai?
                </h4>
                <p className="text-xs text-surface-400 mt-0.5">
                  Gunakan template CSV resmi SDLG dengan kolom: No Unit, VIN, Model, Cabang, Customer, dan Tahun BL.
                </p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-accent" />
                Unduh Format CSV
              </button>
            </div>

            {/* Upload Area */}
            {!parsedRows.length && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-surface-700 hover:border-accent/60 rounded-2xl p-8 text-center cursor-pointer transition-all bg-surface-950/40 hover:bg-surface-950/70 space-y-3"
              >
                <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 text-accent flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-surface-100">
                    Klik atau Tarik Berkas CSV ke Sini
                  </p>
                  <p className="text-xs text-surface-500 mt-1">
                    Mendukung format .csv dengan pemisah koma (comma-delimited)
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-400/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Import Result Notification */}
            {importResult && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-1">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Impor Berhasil Diselesaikan!
                </div>
                <p className="text-xs text-surface-300">
                  Berhasil menyimpan <strong>{importResult.successCount}</strong> unit ke database.
                  {importResult.failedCount > 0 && (
                    <span className="text-red-400 ml-1">
                      ({importResult.failedCount} unit gagal).
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Parsed Preview Table */}
            {parsedRows.length > 0 && !importResult && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-surface-200 font-semibold">
                      Pratinjau Data ({parsedRows.length} baris)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
                      ✓ {validCount} Siap Impor
                    </span>
                    {invalidCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-red-400/15 text-red-400 font-medium">
                        ✗ {invalidCount} Tidak Valid
                      </span>
                    )}
                  </div>
                  <button onClick={resetAll} className="text-surface-400 hover:text-red-400 text-xs">
                    Ganti Berkas
                  </button>
                </div>

                <div className="card overflow-hidden p-0 border border-surface-800 max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-950/80 sticky top-0 text-left text-surface-400 border-b border-surface-800">
                      <tr>
                        <th className="px-3 py-2 font-semibold">No Unit</th>
                        <th className="px-3 py-2 font-semibold">VIN</th>
                        <th className="px-3 py-2 font-semibold">Model</th>
                        <th className="px-3 py-2 font-semibold">Cabang</th>
                        <th className="px-3 py-2 font-semibold">Tahun BL</th>
                        <th className="px-3 py-2 font-semibold">Status Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-800/40 font-mono">
                      {parsedRows.slice(0, 50).map((r, i) => (
                        <tr key={i} className="hover:bg-surface-800/30">
                          <td className="px-3 py-2 font-sans font-semibold text-surface-100">
                            {r.unit_number || '—'}
                          </td>
                          <td className="px-3 py-2 text-surface-400">{r.vin || '—'}</td>
                          <td className="px-3 py-2 font-sans font-medium text-surface-200">
                            {r.model || <span className="text-amber-400">Auto-detect</span>}
                          </td>
                          <td className="px-3 py-2 font-sans text-surface-300">{r.under_cabang}</td>
                          <td className="px-3 py-2">
                            {r.year_delivery === 2026 ? (
                              <span className="text-red-400 font-bold">2026 (Wajib CSA)</span>
                            ) : (
                              r.year_delivery || '—'
                            )}
                          </td>
                          <td className="px-3 py-2 font-sans">
                            {r.isValid ? (
                              <span className="text-emerald-400 font-semibold text-[11px]">Valid</span>
                            ) : (
                              <span className="text-red-400 font-semibold text-[11px]">
                                {r.validationError}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedRows.length > 50 && (
                  <p className="text-[11px] text-surface-500 text-center">
                    Menampilkan 50 baris pertama dari total {parsedRows.length} baris CSV.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-surface-800 flex items-center justify-between">
            <span className="text-xs text-surface-500">
              {file ? `Berkas: ${file.name}` : 'Format yang didukung: .csv'}
            </span>

            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary text-xs px-4 py-2">
                Tutup
              </button>

              {parsedRows.length > 0 && !importResult && (
                <button
                  onClick={handleCommitImport}
                  disabled={isProcessing || validCount === 0}
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 font-semibold"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan ke DB ({importProgress || 0}%)...</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-3.5 h-3.5" />
                      <span>Simpan {validCount} Unit ke Database</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
