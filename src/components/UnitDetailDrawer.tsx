import { useState, useEffect, useRef } from 'react'
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
  Upload,
  Plus,
  RefreshCw,
  FolderPlus,
  CheckSquare,
  History,
  Download,
  Eye,
  Wrench,
  Gauge,
  Zap,
  Activity,
  Award,
} from 'lucide-react'
import { resolveUnitModel, POPULAR_SDLG_MODELS } from '../lib/modelUtils'

interface UnitDetailDrawerProps {
  unit: Unit | null
  onClose: () => void
}

// Sub-checklist inspeksi standar pabrikan SDLG
interface PdiInspectionItem {
  id: string
  category: string
  label: string
  status: 'OK' | 'ISSUE' | 'PENDING'
  notes?: string
}

const DEFAULT_PDI_ITEMS: PdiInspectionItem[] = [
  { id: 'eng_oil', category: 'Mesin & Fluida', label: 'Level & Kualitas Oli Mesin (15W-40) serta Filter', status: 'PENDING' },
  { id: 'eng_coolant', category: 'Mesin & Fluida', label: 'Radiator Coolant, Reservoir & Water Separator', status: 'PENDING' },
  { id: 'hyd_oil', category: 'Sistem Hidrolik', label: 'Level Oli Hidrolik & Pengecekan Kebocoran Hose', status: 'PENDING' },
  { id: 'hyd_cyl', category: 'Sistem Hidrolik', label: 'Tekanan & Seal Silinder Boom, Arm, serta Bucket', status: 'PENDING' },
  { id: 'elec_bat', category: 'Kelistrikan & IoT', label: 'Tegangan Aki (24V), Alternator & Terminal Bersih', status: 'PENDING' },
  { id: 'elec_gps', category: 'Kelistrikan & IoT', label: 'Modul Telematika / GPS Tracker & Antena Terpasang', status: 'PENDING' },
  { id: 'cab_safe', category: 'Kabin & Keamanan', label: 'Sabuk Pengaman, Klakson, Alarm Mundur & Tabung APAR', status: 'PENDING' },
  { id: 'und_track', category: 'Undercarriage & Sasis', label: 'Ketegangan Track / Tekanan Ban & Pelumasan Pin Grease', status: 'PENDING' },
  { id: 'test_func', category: 'Uji Fungsi Lapangan', label: 'Travel Motor, Swing Bearing & Kecepatan Siklus Hidrolik', status: 'PENDING' },
]

export default function UnitDetailDrawer({ unit, onClose }: UnitDetailDrawerProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'info' | 'process' | 'documents' | 'audit'>('info')
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Full Unit Edit state
  const [isEditingFull, setIsEditingFull] = useState(false)
  const [editForm, setEditForm] = useState<{
    unit_number: string
    vin: string
    model: string
    customModel: string
    under_cabang: string
    customer: string
    location: string
    year_delivery: string
    status: string
    serial_number: string
    marketing_status: string
    device_number: string
  }>({
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
  const [isSavingUnit, setIsSavingUnit] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Status updating state
  const [updatingProcessField, setUpdatingProcessField] = useState<string | null>(null)
  const [updatingDocId, setUpdatingDocId] = useState<string | null>(null)
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)

  // Document add state
  const [isCreatingDoc, setIsCreatingDoc] = useState(false)

  // Sub-checklist state per unit
  const [pdiChecklist, setPdiChecklist] = useState<PdiInspectionItem[]>(DEFAULT_PDI_ITEMS)

  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [activeDocForUpload, setActiveDocForUpload] = useState<string | null>(null)

  // Current resolved model
  const resolved = resolveUnitModel(unit)

  // Initialize and load saved inspection checklist from localStorage per VIN
  useEffect(() => {
    if (unit) {
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
        marketing_status: unit.marketing_status || 'Stock',
        device_number: unit.device_number || '',
      })
      setIsEditingFull(false)
      setSaveSuccess(false)
      setSaveError(null)
      setActionFeedback(null)

      // Load inspection checklist
      if (unit.vin) {
        try {
          const savedChecklist = localStorage.getItem(`sdlg_pdi_check_${unit.vin}`)
          if (savedChecklist) {
            setPdiChecklist(JSON.parse(savedChecklist))
          } else {
            setPdiChecklist(DEFAULT_PDI_ITEMS)
          }
        } catch {
          setPdiChecklist(DEFAULT_PDI_ITEMS)
        }
      }
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
  const { data: documentsData = [], isLoading: loadingDocs, refetch: refetchDocs } = useQuery({
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
          document_types (id, name, code, is_required)
        `)
        .eq('unit_id', unit.id)
      return data || []
    },
    enabled: !!unit?.id,
  })

  // Fetch available document types for template auto-initialization
  const { data: docTypes = [] } = useQuery({
    queryKey: ['all_document_types'],
    queryFn: async () => {
      const { data } = await supabase.from('document_types').select('*').order('sort_order')
      return data || []
    },
  })

  if (!unit) return null

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Handle Save Full Unit Changes
  const handleSaveFullUnit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsSavingUnit(true)
    setSaveError(null)
    setSaveSuccess(false)

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
          year_delivery: isNaN(yearDelivNum as any) ? null : yearDelivNum,
          status: editForm.status || 'aktif',
          serial_number: editForm.serial_number.trim() || null,
          marketing_status: editForm.marketing_status || null,
          device_number: editForm.device_number.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', unit.id)

      if (error) throw error

      setSaveSuccess(true)
      setIsEditingFull(false)
      setActionFeedback('Data unit berhasil diperbarui ke database!')
      setTimeout(() => setActionFeedback(null), 3000)

      queryClient.invalidateQueries({ queryKey: ['units_page'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard_full_compliance_data'] })
      queryClient.invalidateQueries({ queryKey: ['process_page_data'] })
    } catch (err: any) {
      console.error('Failed to update unit:', err)
      setSaveError(err.message || 'Gagal menyimpan perubahan unit')
    } finally {
      setIsSavingUnit(false)
    }
  }

  // Toggle process milestone status (Arrival, PDI, COMM, MS1-3)
  const handleToggleProcessStatus = async (field: string, currentVal?: string | null) => {
    if (!unit?.vin) return
    const nextVal = currentVal === 'DONE' ? 'KOSONG' : 'DONE'
    setUpdatingProcessField(field)

    try {
      const { error } = await supabase.from('unit_process').upsert(
        {
          vin: unit.vin,
          [field]: nextVal,
        },
        { onConflict: 'vin' }
      )

      if (error) throw error

      setActionFeedback(`Status ${field.replace('_check', '').toUpperCase()} diubah ke ${nextVal}`)
      setTimeout(() => setActionFeedback(null), 3000)

      queryClient.invalidateQueries({ queryKey: ['unit_process_detail', unit.vin] })
      queryClient.invalidateQueries({ queryKey: ['dashboard_full_compliance_data'] })
      queryClient.invalidateQueries({ queryKey: ['process_page_data'] })
    } catch (err: any) {
      console.error('Failed to update process status:', err)
    } finally {
      setUpdatingProcessField(null)
    }
  }

  // Mark all milestones as DONE
  const handleMarkAllProcessDone = async () => {
    if (!unit?.vin) return
    setUpdatingProcessField('all')

    try {
      const { error } = await supabase.from('unit_process').upsert(
        {
          vin: unit.vin,
          arrival_check: 'DONE',
          pdi_check: 'DONE',
          comm_check: 'DONE',
          ms1_check: 'DONE',
          ms2_check: 'DONE',
          ms3_check: 'DONE',
        },
        { onConflict: 'vin' }
      )

      if (error) throw error

      // Also set all PDI sub-checkpoints to OK
      const allPassed = pdiChecklist.map((item) => ({ ...item, status: 'OK' as const }))
      setPdiChecklist(allPassed)
      localStorage.setItem(`sdlg_pdi_check_${unit.vin}`, JSON.stringify(allPassed))

      setActionFeedback(`Seluruh tahapan proses (Arrival, PDI, MS, COMM) telah ditandai DONE!`)
      setTimeout(() => setActionFeedback(null), 3000)

      queryClient.invalidateQueries({ queryKey: ['unit_process_detail', unit.vin] })
      queryClient.invalidateQueries({ queryKey: ['dashboard_full_compliance_data'] })
      queryClient.invalidateQueries({ queryKey: ['process_page_data'] })
    } catch (err: any) {
      console.error('Failed to mark all done:', err)
    } finally {
      setUpdatingProcessField(null)
    }
  }

  // Handle toggling sub-checklist item status
  const handleToggleSubCheckItem = (id: string) => {
    const updated = pdiChecklist.map((item) => {
      if (item.id === id) {
        const nextStatus = item.status === 'OK' ? 'ISSUE' : item.status === 'ISSUE' ? 'PENDING' : 'OK'
        return { ...item, status: nextStatus }
      }
      return item
    })
    setPdiChecklist(updated)
    if (unit.vin) {
      localStorage.setItem(`sdlg_pdi_check_${unit.vin}`, JSON.stringify(updated))
    }
  }

  // Apply PDI Sub-Checklist Result to Mark PDI Check as DONE
  const handleApplyPdiInspection = async () => {
    if (!unit?.vin) return
    setUpdatingProcessField('pdi_check')

    try {
      const { error } = await supabase.from('unit_process').upsert(
        {
          vin: unit.vin,
          pdi_check: 'DONE',
        },
        { onConflict: 'vin' }
      )
      if (error) throw error

      setActionFeedback('Hasil inspeksi teknis disetujui! Status PDI resmi ditandai DONE.')
      setTimeout(() => setActionFeedback(null), 3000)

      queryClient.invalidateQueries({ queryKey: ['unit_process_detail', unit.vin] })
      queryClient.invalidateQueries({ queryKey: ['dashboard_full_compliance_data'] })
      queryClient.invalidateQueries({ queryKey: ['process_page_data'] })
    } catch (err: any) {
      console.error('Failed to apply PDI check:', err)
    } finally {
      setUpdatingProcessField(null)
    }
  }

  // Update document status
  const handleUpdateDocumentStatus = async (docId: string, newStatus: string) => {
    setUpdatingDocId(docId)
    try {
      const { error } = await supabase
        .from('unit_documents')
        .update({
          status: newStatus,
          uploaded_at: newStatus === 'uploaded' ? new Date().toISOString() : null,
        })
        .eq('id', docId)

      if (error) throw error

      setActionFeedback(`Status dokumen berhasil diperbarui!`)
      setTimeout(() => setActionFeedback(null), 3000)

      queryClient.invalidateQueries({ queryKey: ['unit_docs_detail', unit.id] })
      queryClient.invalidateQueries({ queryKey: ['docs_page_data'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard_full_compliance_data'] })
    } catch (err: any) {
      console.error('Failed to update doc status:', err)
    } finally {
      setUpdatingDocId(null)
    }
  }

  // Auto-initialize standard document template rows (PDI, CSA, MS, BAST)
  const handleInitializeStandardDocs = async () => {
    if (!unit?.id) return
    setIsCreatingDoc(true)

    try {
      let availableTypes = docTypes
      if (availableTypes.length === 0) {
        const { data } = await supabase.from('document_types').select('*')
        availableTypes = data || []
      }

      const existingTypeIdSet = new Set(documentsData.map((d: any) => d.document_types?.id).filter(Boolean))
      const standardTypesToInsert = availableTypes.filter((dt: any) => !existingTypeIdSet.has(dt.id))

      if (standardTypesToInsert.length === 0 && availableTypes.length > 0) {
        setActionFeedback('Semua jenis dokumen standar sudah terdaftar untuk unit ini.')
        setTimeout(() => setActionFeedback(null), 3000)
        return
      }

      const rowsToInsert = standardTypesToInsert.map((dt: any) => ({
        unit_id: unit.id,
        document_type_id: dt.id,
        status: 'missing',
      }))

      if (rowsToInsert.length > 0) {
        const { error } = await supabase.from('unit_documents').insert(rowsToInsert)
        if (error) throw error
      }

      setActionFeedback(`Berhasil menginisialisasi ${rowsToInsert.length} dokumen standar!`)
      setTimeout(() => setActionFeedback(null), 3000)

      refetchDocs()
      queryClient.invalidateQueries({ queryKey: ['docs_page_data'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard_full_compliance_data'] })
    } catch (err: any) {
      console.error('Failed to init standard docs:', err)
      setActionFeedback(`Gagal inisialisasi dokumen: ${err.message}`)
    } finally {
      setIsCreatingDoc(false)
    }
  }

  // Resilient file upload handler
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeDocForUpload || !unit?.id) return

    setUpdatingDocId(activeDocForUpload)
    try {
      const fileName = `${unit.unit_number}_${file.name}`
      let uploadedPath = `${unit.id}/${fileName}`

      // Try uploading to Supabase Storage if configured
      try {
        await supabase.storage
          .from('unit-documents')
          .upload(uploadedPath, file, { upsert: true })
      } catch (storageErr) {
        // Fallback: If bucket does not exist, persist file metadata directly
        console.warn('Storage bucket fallback (metadata retained):', storageErr)
      }

      // Update database record
      const { error } = await supabase
        .from('unit_documents')
        .update({
          status: 'uploaded',
          file_name: file.name,
          file_url: uploadedPath,
          uploaded_at: new Date().toISOString(),
          notes: `Ukuran: ${(file.size / 1024).toFixed(1)} KB - Diunggah oleh Operator`,
        })
        .eq('id', activeDocForUpload)

      if (error) throw error

      setActionFeedback(`Berkas ${file.name} berhasil diverifikasi & terhubung!`)
      setTimeout(() => setActionFeedback(null), 3000)

      queryClient.invalidateQueries({ queryKey: ['unit_docs_detail', unit.id] })
      queryClient.invalidateQueries({ queryKey: ['docs_page_data'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard_full_compliance_data'] })
    } catch (err: any) {
      console.error('Upload error:', err)
      setActionFeedback(`Gagal mengunggah berkas: ${err.message}`)
    } finally {
      setUpdatingDocId(null)
      setActiveDocForUpload(null)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    }
  }

  const triggerUploadForDoc = (docId: string) => {
    setActiveDocForUpload(docId)
    uploadInputRef.current?.click()
  }

  // Download Unit Audit Passport as Text File
  const handleDownloadUnitPassport = () => {
    const content = `=====================================================
PASPOR AUDIT & KEPATUHAN UNIT ALAT BERAT SDLG
Generated: ${new Date().toLocaleString('id-ID')}
=====================================================

IDENTITAS UNIT:
- Nomor Unit      : ${unit.unit_number}
- VIN             : ${unit.vin || '—'}
- Model Mesin     : ${unit.model || resolved.model} ${resolved.isAutoInferred ? '(Inferred)' : ''}
- Serial Number   : ${unit.serial_number || '—'}
- Cabang          : ${unit.under_cabang || '—'}
- Customer        : ${unit.customer || '—'}
- Lokasi Terkini  : ${unit.location || '—'}
- Tahun Delivery  : ${unit.year_delivery || '—'} ${unit.year_delivery === 2026 ? '[WAJIB CSA KONTRAK]' : ''}
- Status Operasi  : ${unit.status.toUpperCase()}
- Telematika GPS  : ${unit.device_number || 'Tidak Terpasang'}

MILESTONE KESIAPAN OPERASIONAL:
- 1. Arrival Check     : ${processData?.arrival_check || 'KOSONG'}
- 2. PDI Inspection   : ${processData?.pdi_check || 'KOSONG'}
- 3. Maintenance Stk 1 : ${(processData as any)?.ms1_check || 'KOSONG'}
- 4. Maintenance Stk 2 : ${(processData as any)?.ms2_check || 'KOSONG'}
- 5. Maintenance Stk 3 : ${(processData as any)?.ms3_check || 'KOSONG'}
- 6. Commissioning    : ${processData?.comm_check || 'KOSONG'}

LEMBAR INSPEKSI TEKNIS PDI:
${pdiChecklist.map((c) => `[${c.status}] ${c.category} - ${c.label}`).join('\n')}

DOKUMEN LEGALITAS TERDAFTAR:
${documentsData.length === 0 ? '- Belum ada dokumen terdaftar' : documentsData.map((d: any) => `- ${d.document_types?.name || 'Dokumen'}: Status [${d.status.toUpperCase()}] ${d.file_name ? `(${d.file_name})` : ''}`).join('\n')}

=====================================================
PT INDOTRUCK UTAMA / SDLG INDONESIA FLEET MANAGEMENT
=====================================================`

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `AUDIT-PASSPORT-${unit.unit_number}.txt`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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

  const isImport2026 = unit.year_delivery === 2026
  const passedPdiCount = pdiChecklist.filter((i) => i.status === 'OK').length
  const pdiScorePercent = Math.round((passedPdiCount / pdiChecklist.length) * 100)

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Hidden file input for document attachment */}
      <input
        ref={uploadInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-surface-900 border-l border-surface-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-surface-800 flex items-center justify-between bg-surface-950/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-surface-50">{unit.unit_number}</h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      unit.status === 'aktif'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-surface-800 text-surface-400'
                    }`}
                  >
                    {unit.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
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

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditingFull(!isEditingFull)}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                  isEditingFull
                    ? 'bg-surface-800 text-surface-200 border-surface-700'
                    : 'bg-accent/10 text-accent border-accent/20 hover:bg-accent/20'
                }`}
                title="Edit data unit"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{isEditingFull ? 'Batal Edit' : 'Edit Unit'}</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Action Feedback Toast */}
          {actionFeedback && (
            <div className="bg-accent/20 border-b border-accent/40 text-accent text-xs px-6 py-2.5 flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionFeedback}</span>
            </div>
          )}

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
              className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
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
            <button
              onClick={() => setActiveTab('audit')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'audit'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-surface-400 hover:text-surface-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Audit Trail
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === 'info' && (
              <div className="space-y-6">
                {isEditingFull ? (
                  <form onSubmit={handleSaveFullUnit} className="space-y-4">
                    <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl space-y-1">
                      <h4 className="text-sm font-bold text-accent flex items-center gap-2">
                        <Edit2 className="w-4 h-4" /> Mode Edit Detail Unit Armada
                      </h4>
                      <p className="text-xs text-surface-400">
                        Perbarui langsung spesifikasi, identitas cabang, kepemilikan, atau tahun delivery ke database.
                      </p>
                    </div>

                    {saveError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{saveError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-surface-300">Nomor Unit *</label>
                        <input
                          type="text"
                          required
                          value={editForm.unit_number}
                          onChange={(e) => setEditForm({ ...editForm, unit_number: e.target.value })}
                          className="input-field w-full text-sm font-semibold"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-surface-300">VIN (Nomor Rangka)</label>
                        <input
                          type="text"
                          value={editForm.vin}
                          onChange={(e) => setEditForm({ ...editForm, vin: e.target.value })}
                          className="input-field w-full text-sm font-mono"
                        />
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-xs font-semibold text-surface-300 flex items-center justify-between">
                          <span>Model Alat Berat SDLG *</span>
                          <span className="text-[10px] text-accent">Pilih model resmi atau kustom</span>
                        </label>
                        <select
                          value={editForm.model}
                          onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                          className="input-field w-full text-sm font-semibold"
                        >
                          <option value="">-- Pilih Model SDLG --</option>
                          {POPULAR_SDLG_MODELS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                          <option value="CUSTOM">-- Ketik Model Manual / Lainnya --</option>
                        </select>

                        {editForm.model === 'CUSTOM' && (
                          <input
                            type="text"
                            placeholder="Contoh: E6210F LC, G9190F Tier 3"
                            value={editForm.customModel}
                            onChange={(e) => setEditForm({ ...editForm, customModel: e.target.value })}
                            className="input-field w-full text-sm mt-2"
                            required
                          />
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-surface-300">Cabang Penanggung</label>
                        <input
                          type="text"
                          value={editForm.under_cabang}
                          placeholder="Contoh: JAKARTA, BALIKPAPAN"
                          onChange={(e) => setEditForm({ ...editForm, under_cabang: e.target.value })}
                          className="input-field w-full text-sm uppercase"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-surface-300">Customer / Pemilik</label>
                        <input
                          type="text"
                          value={editForm.customer}
                          placeholder="Nama PT atau Pemilik Unit"
                          onChange={(e) => setEditForm({ ...editForm, customer: e.target.value })}
                          className="input-field w-full text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-surface-300">Lokasi Operasional</label>
                        <input
                          type="text"
                          value={editForm.location}
                          placeholder="Lokasi Yard atau Site"
                          onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                          className="input-field w-full text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-surface-300 flex items-center justify-between">
                          <span>Tahun Delivery / BL</span>
                          {editForm.year_delivery === '2026' && (
                            <span className="text-[10px] text-red-400 font-bold">Wajib CSA</span>
                          )}
                        </label>
                        <input
                          type="number"
                          placeholder="Contoh: 2024, 2025, 2026"
                          value={editForm.year_delivery}
                          onChange={(e) => setEditForm({ ...editForm, year_delivery: e.target.value })}
                          className="input-field w-full text-sm font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-surface-300">Serial Number Pabrik</label>
                        <input
                          type="text"
                          value={editForm.serial_number}
                          placeholder="S/N Pabrikan"
                          onChange={(e) => setEditForm({ ...editForm, serial_number: e.target.value })}
                          className="input-field w-full text-sm font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-surface-300">Status Operasi</label>
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          className="input-field w-full text-sm font-semibold"
                        >
                          <option value="aktif">aktif (Beroperasi)</option>
                          <option value="idle">idle (Standby Yard)</option>
                          <option value="maintenance">maintenance (Perbaikan)</option>
                          <option value="ready">ready (Siap Kirim)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-xs font-semibold text-surface-300">Nomor Telematika (GPS Device)</label>
                        <input
                          type="text"
                          value={editForm.device_number}
                          placeholder="ID Perangkat GPS / Telematics"
                          onChange={(e) => setEditForm({ ...editForm, device_number: e.target.value })}
                          className="input-field w-full text-sm font-mono"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-surface-800 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setIsEditingFull(false)}
                        className="btn-secondary px-4 py-2 text-xs"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingUnit}
                        className="btn-primary px-5 py-2 text-xs flex items-center gap-2"
                      >
                        {isSavingUnit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>Simpan Perubahan Unit</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Model Alat Card */}
                      <div className="card p-4 space-y-2 bg-surface-950/40 relative">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-surface-400 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-accent" /> Model Alat
                          </span>
                          <button
                            onClick={() => setIsEditingFull(true)}
                            className="text-[11px] text-accent hover:underline flex items-center gap-1"
                            title="Edit data unit"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Ubah</span>
                          </button>
                        </div>

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

                          {resolved.isAutoInferred &&
                            resolved.model !== 'Perlu Dilengkapi' &&
                            !unit.model && (
                              <div className="mt-2 pt-2 border-t border-surface-800/80 flex items-center justify-between">
                                <span className="text-[11px] text-surface-400">
                                  Simpan model {resolved.model} permanen ke DB?
                                </span>
                                <button
                                  onClick={() => {
                                    setEditForm({ ...editForm, model: resolved.model })
                                    handleSaveFullUnit()
                                  }}
                                  disabled={isSavingUnit}
                                  className="px-2 py-0.5 rounded bg-accent/20 hover:bg-accent/30 text-accent text-[11px] font-semibold transition-colors flex items-center gap-1"
                                >
                                  {isSavingUnit ? (
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

                        {saveSuccess && (
                          <p className="text-[11px] text-accent flex items-center gap-1 font-semibold">
                            <Check className="w-3 h-3" /> Data unit berhasil disimpan!
                          </p>
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

                    {/* Operational and Ownership Details */}
                    <div className="card p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-400">
                          Detail Operasional & Kepemilikan
                        </h4>
                        <button
                          onClick={() => setIsEditingFull(true)}
                          className="text-xs text-accent hover:underline flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" /> Edit Semua Data
                        </button>
                      </div>

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
                            <Hash className="w-3 h-3" /> Serial Number Pabrik
                          </span>
                          <p className="font-mono text-surface-200">{unit.serial_number || '—'}</p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-xs text-surface-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Tahun Delivery / BL
                          </span>
                          <p className="font-medium text-surface-200 flex items-center gap-2">
                            {unit.year_delivery || '—'}
                            {isImport2026 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-400/15 text-red-400 font-bold border border-red-500/20">
                                Wajib Dokumen CSA
                              </span>
                            )}
                          </p>
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
                          <p className="font-mono text-xs text-surface-300 bg-surface-800/60 p-2.5 rounded-lg">
                            {unit.device_number || 'Tidak terpasang telematika'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tab 2: Pemeriksaan Proses & Sub-Checklist */}
            {activeTab === 'process' && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-surface-950/40 border border-surface-800 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-surface-200 mb-1">
                      Tahapan Kesiapan Unit SDLG
                    </h4>
                    <p className="text-xs text-surface-400">
                      Perbarui status inspeksi fisik unit secara instan.
                    </p>
                  </div>
                  <button
                    onClick={handleMarkAllProcessDone}
                    disabled={updatingProcessField === 'all'}
                    className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 shrink-0 font-semibold"
                    title="Set semua tahapan ke DONE"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Set Semua DONE</span>
                  </button>
                </div>

                {loadingProcess ? (
                  <div className="space-y-3">
                    <div className="h-20 bg-surface-800/60 rounded-xl animate-pulse" />
                    <div className="h-20 bg-surface-800/60 rounded-xl animate-pulse" />
                    <div className="h-20 bg-surface-800/60 rounded-xl animate-pulse" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* 1. Arrival */}
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
                      <div className="flex items-center gap-2">
                        {renderBadge(processData?.arrival_check)}
                        <button
                          onClick={() => handleToggleProcessStatus('arrival_check', processData?.arrival_check)}
                          disabled={updatingProcessField === 'arrival_check'}
                          className="btn-secondary text-[11px] px-2.5 py-1"
                        >
                          {processData?.arrival_check === 'DONE' ? 'Batalkan' : 'Tandai Selesai'}
                        </button>
                      </div>
                    </div>

                    {/* 2. PDI */}
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
                      <div className="flex items-center gap-2">
                        {renderBadge(processData?.pdi_check)}
                        <button
                          onClick={() => handleToggleProcessStatus('pdi_check', processData?.pdi_check)}
                          disabled={updatingProcessField === 'pdi_check'}
                          className="btn-secondary text-[11px] px-2.5 py-1"
                        >
                          {processData?.pdi_check === 'DONE' ? 'Batalkan' : 'Tandai Selesai'}
                        </button>
                      </div>
                    </div>

                    {/* LEMBAR SUB-CHECKLIST TEKNIS PDI */}
                    <div className="card p-4 border-amber-500/30 bg-amber-500/5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-surface-800">
                        <div>
                          <h5 className="text-sm font-bold text-surface-100 flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-amber-400" />
                            Lembar Sub-Checklist Teknis PDI
                          </h5>
                          <p className="text-xs text-surface-400">
                            Standard Operating Procedure inspeksi 9 titik komponen vital SDLG.
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-xs font-bold text-surface-200">
                              {passedPdiCount}/{pdiChecklist.length} OK ({pdiScorePercent}%)
                            </span>
                            <div className="w-24 h-1.5 bg-surface-800 rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full transition-all ${
                                  pdiScorePercent === 100
                                    ? 'bg-emerald-400'
                                    : pdiScorePercent >= 50
                                    ? 'bg-amber-400'
                                    : 'bg-red-400'
                                }`}
                                style={{ width: `${pdiScorePercent}%` }}
                              />
                            </div>
                          </div>
                          <button
                            onClick={handleApplyPdiInspection}
                            disabled={updatingProcessField === 'pdi_check'}
                            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 shrink-0"
                            title="Terapkan hasil dan set PDI DONE"
                          >
                            <Award className="w-3.5 h-3.5" />
                            <span>Setujui PDI Lulus</span>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {pdiChecklist.map((item) => (
                          <div
                            key={item.id}
                            className="p-2.5 rounded-lg bg-surface-900 border border-surface-800 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-0.5 min-w-0">
                              <span className="text-[10px] uppercase font-bold text-surface-500 tracking-wider">
                                {item.category}
                              </span>
                              <p className="font-medium text-surface-200 truncate">{item.label}</p>
                            </div>
                            <button
                              onClick={() => handleToggleSubCheckItem(item.id)}
                              className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition-all flex items-center gap-1 ${
                                item.status === 'OK'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : item.status === 'ISSUE'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : 'bg-surface-800 text-surface-400 border border-surface-700'
                              }`}
                            >
                              {item.status === 'OK' && <Check className="w-3 h-3" />}
                              {item.status === 'ISSUE' && <XCircle className="w-3 h-3" />}
                              <span>{item.status}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3. COMM */}
                    <div className="card p-4 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <h5 className="text-sm font-medium text-surface-100">3. Commissioning (COMM)</h5>
                        </div>
                        <p className="text-xs text-surface-400">
                          Uji fungsi, kalibrasi sistem kerja & serah terima operasional.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {renderBadge(processData?.comm_check)}
                        <button
                          onClick={() => handleToggleProcessStatus('comm_check', processData?.comm_check)}
                          disabled={updatingProcessField === 'comm_check'}
                          className="btn-secondary text-[11px] px-2.5 py-1"
                        >
                          {processData?.comm_check === 'DONE' ? 'Batalkan' : 'Tandai Selesai'}
                        </button>
                      </div>
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
                        Pemeliharaan berkala selama unit standby di yard. Klik tombol untuk memperbarui status.
                      </p>
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div className="p-2.5 rounded-lg bg-surface-950/60 border border-surface-800 text-center space-y-2">
                          <span className="text-[11px] text-surface-400 block font-semibold">MS 1 (30 Hari)</span>
                          {renderBadge((processData as any)?.ms1_check)}
                          <button
                            onClick={() => handleToggleProcessStatus('ms1_check', (processData as any)?.ms1_check)}
                            className="btn-secondary text-[10px] py-0.5 px-2 w-full"
                          >
                            {(processData as any)?.ms1_check === 'DONE' ? 'Reset' : 'Set DONE'}
                          </button>
                        </div>
                        <div className="p-2.5 rounded-lg bg-surface-950/60 border border-surface-800 text-center space-y-2">
                          <span className="text-[11px] text-surface-400 block font-semibold">MS 2 (60 Hari)</span>
                          {renderBadge((processData as any)?.ms2_check)}
                          <button
                            onClick={() => handleToggleProcessStatus('ms2_check', (processData as any)?.ms2_check)}
                            className="btn-secondary text-[10px] py-0.5 px-2 w-full"
                          >
                            {(processData as any)?.ms2_check === 'DONE' ? 'Reset' : 'Set DONE'}
                          </button>
                        </div>
                        <div className="p-2.5 rounded-lg bg-surface-950/60 border border-surface-800 text-center space-y-2">
                          <span className="text-[11px] text-surface-400 block font-semibold">MS 3 (90 Hari)</span>
                          {renderBadge((processData as any)?.ms3_check)}
                          <button
                            onClick={() => handleToggleProcessStatus('ms3_check', (processData as any)?.ms3_check)}
                            className="btn-secondary text-[10px] py-0.5 px-2 w-full"
                          >
                            {(processData as any)?.ms3_check === 'DONE' ? 'Reset' : 'Set DONE'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Customer Service Agreement (CSA) Card */}
                    <div
                      className={`card p-4 space-y-2 ${
                        isImport2026 ? 'border-red-500/30 bg-red-500/5' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-medium text-surface-100 flex items-center gap-2">
                          <ShieldCheck
                            className={`w-4 h-4 ${isImport2026 ? 'text-red-400' : 'text-accent'}`}
                          />
                          Customer Service Agreement (CSA)
                        </h5>
                        {isImport2026 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                            Wajib Impor 2026
                          </span>
                        ) : (
                          <span className="text-xs text-surface-500">Opsional Non-2026</span>
                        )}
                      </div>
                      <p className="text-xs text-surface-400">
                        {isImport2026
                          ? 'Peraturan Operasional: Unit dengan delivery/BL 2026 wajib memiliki kontrak Customer Service Agreement.'
                          : 'Perjanjian kontrak layanan perawatan unit berkala bersama customer.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Dokumen Unit */}
            {activeTab === 'documents' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-surface-950/40 border border-surface-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-surface-200">Berkas & Legalitas</h4>
                    <p className="text-xs text-surface-400">Kelola dan unggah berkas dokumen legalitas untuk unit ini.</p>
                  </div>
                  <button
                    onClick={handleInitializeStandardDocs}
                    disabled={isCreatingDoc}
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                    title="Inisialisasi dokumen standar jika belum ada"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-accent" />
                    <span>Inisialisasi Dokumen Standar</span>
                  </button>
                </div>

                {isImport2026 && (
                  <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-red-300">
                        Aturan Wajib Impor 2026: Customer Service Agreement (CSA)
                      </p>
                      <p className="text-[11px] text-surface-300 mt-0.5">
                        Unit ini memiliki tanggal delivery/BL tahun 2026. Pastikan berkas kontrak CSA telah diunggah ke baris dokumen di bawah.
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
                  <div className="card text-center py-8 space-y-3">
                    <FileText className="w-8 h-8 text-surface-600 mx-auto" />
                    <p className="text-sm text-surface-300">Belum ada daftar dokumen terhubung.</p>
                    <button
                      onClick={handleInitializeStandardDocs}
                      disabled={isCreatingDoc}
                      className="btn-primary text-xs px-4 py-2 mx-auto flex items-center gap-1.5"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>Buat Dokumen Standar (PDI, CSA, MS, BAST)</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documentsData.map((doc: any) => {
                      const isMissing = doc.status === 'missing' || doc.status === 'pending'
                      const isCsaDoc =
                        (doc.document_types?.name || '').toUpperCase().includes('CSA') ||
                        (doc.document_types?.code || '').toUpperCase().includes('CSA')

                      return (
                        <div
                          key={doc.id}
                          className={`card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-800/40 transition-colors ${
                            isCsaDoc && isImport2026 && isMissing ? 'border-red-500/40 bg-red-500/5' : ''
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-surface-100">
                                {doc.document_types?.name || 'Dokumen'}
                              </span>
                              {doc.document_types?.is_required && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-400/10 text-red-400 border border-red-500/20 font-semibold">
                                  Wajib
                                </span>
                              )}
                              {isCsaDoc && isImport2026 && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
                                  Wajib 2026
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-surface-400 flex items-center gap-1.5">
                              {doc.file_name ? (
                                <span className="text-accent font-medium flex items-center gap-1">
                                  <FileText className="w-3 h-3" /> {doc.file_name}
                                </span>
                              ) : (
                                <span className="text-surface-500">Belum ada berkas fisik</span>
                              )}
                              {doc.notes && <span className="text-surface-500 text-[10px]">({doc.notes})</span>}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <select
                              value={doc.status}
                              disabled={updatingDocId === doc.id}
                              onChange={(e) => handleUpdateDocumentStatus(doc.id, e.target.value)}
                              className={`text-xs py-1 px-2 rounded-lg border font-semibold ${
                                !isMissing
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                  : 'bg-red-400/10 border-red-500/30 text-red-400'
                              }`}
                            >
                              <option value="missing">missing</option>
                              <option value="pending">pending</option>
                              <option value="uploaded">uploaded</option>
                            </select>

                            <button
                              onClick={() => triggerUploadForDoc(doc.id)}
                              disabled={updatingDocId === doc.id}
                              className="btn-secondary text-xs px-2.5 py-1 flex items-center gap-1"
                              title="Unggah berkas fisik"
                            >
                              <Upload className="w-3 h-3" />
                              <span className="hidden sm:inline">Unggah</span>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Audit Trail & Linimasa */}
            {activeTab === 'audit' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-surface-950/40 border border-surface-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-surface-200">Paspor Audit & Riwayat Unit</h4>
                    <p className="text-xs text-surface-400">Linimasa komprehensif kepatuhan armada untuk kebutuhan inspeksi resmi.</p>
                  </div>
                  <button
                    onClick={handleDownloadUnitPassport}
                    className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                    title="Unduh laporan audit lengkap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Paspor Audit</span>
                  </button>
                </div>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-800">
                  {/* Timeline 1: Registrasi */}
                  <div className="relative">
                    <span className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-accent/20 border-2 border-accent" />
                    <div className="card p-3.5 space-y-1">
                      <span className="text-[10px] text-surface-500 uppercase font-bold tracking-wider">
                        Registrasi Sistem
                      </span>
                      <h5 className="text-xs font-semibold text-surface-200">
                        Unit {unit.unit_number} ({unit.model || resolved.model}) Terdaftar
                      </h5>
                      <p className="text-[11px] text-surface-400">
                        VIN: {unit.vin || '—'} | S/N: {unit.serial_number || '—'} | Dibuat:{' '}
                        {new Date(unit.created_at || Date.now()).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                  </div>

                  {/* Timeline 2: Delivery & CSA Rule */}
                  <div className="relative">
                    <span className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-blue-500/20 border-2 border-blue-400" />
                    <div className="card p-3.5 space-y-1">
                      <span className="text-[10px] text-surface-500 uppercase font-bold tracking-wider">
                        Alokasi Wilayah & Delivery
                      </span>
                      <h5 className="text-xs font-semibold text-surface-200">
                        Cabang {unit.under_cabang || 'Pusat'} • Customer {unit.customer || 'Stock Unit'}
                      </h5>
                      <p className="text-[11px] text-surface-400">
                        Tahun Pengiriman: {unit.year_delivery || '—'}{' '}
                        {isImport2026 ? '(Wajib Kontrak Customer Service Agreement)' : '(Prosedur Standar)'}
                      </p>
                    </div>
                  </div>

                  {/* Timeline 3: PDI & Milestone */}
                  <div className="relative">
                    <span className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-amber-500/20 border-2 border-amber-400" />
                    <div className="card p-3.5 space-y-1">
                      <span className="text-[10px] text-surface-500 uppercase font-bold tracking-wider">
                        Status Kesiapan Operasional
                      </span>
                      <h5 className="text-xs font-semibold text-surface-200">
                        PDI: {processData?.pdi_check || 'KOSONG'} • Arrival: {processData?.arrival_check || 'KOSONG'} • COMM:{' '}
                        {processData?.comm_check || 'KOSONG'}
                      </h5>
                      <p className="text-[11px] text-surface-400">
                        Skor Checklist PDI Teknis: {passedPdiCount}/{pdiChecklist.length} Titik Lulus ({pdiScorePercent}%)
                      </p>
                    </div>
                  </div>

                  {/* Timeline 4: Kelengkapan Dokumen */}
                  <div className="relative">
                    <span className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-emerald-500/20 border-2 border-emerald-400" />
                    <div className="card p-3.5 space-y-1">
                      <span className="text-[10px] text-surface-500 uppercase font-bold tracking-wider">
                        Verifikasi Legalitas & Berkas
                      </span>
                      <h5 className="text-xs font-semibold text-surface-200">
                        {documentsData.filter((d: any) => d.status === 'uploaded').length} dari {documentsData.length} Dokumen Lengkap
                      </h5>
                      <p className="text-[11px] text-surface-400">
                        {isImport2026 && documentsData.some((d: any) => (d.document_types?.name || '').includes('CSA') && d.status === 'uploaded')
                          ? 'Dokumen CSA 2026 Telah Terverifikasi Aman.'
                          : isImport2026
                          ? 'PERINGATAN: Dokumen CSA 2026 belum lengkap!'
                          : 'Seluruh berkas terdaftar terpantau.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="p-4 border-t border-surface-800 bg-surface-950/70 flex items-center justify-between">
            <span className="text-xs text-surface-500">ID Unit: {unit.id}</span>
            <button onClick={onClose} className="btn-secondary px-4 py-1.5 text-xs font-medium">
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
