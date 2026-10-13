import { Unit, UnitProcess, UnitDocument } from './supabase'

export interface UnitComplianceStatus {
  unitId: string
  unitNumber: string
  vin: string
  model: string
  cabang: string
  customer: string
  yearDelivery: number | null
  isImport2026: boolean

  hasArrival: boolean
  arrivalStatus: string

  hasPdiCheck: boolean
  pdiCheckStatus: string
  hasPdiDocument: boolean

  hasMS1: boolean
  ms1Status: string
  hasMS2: boolean
  ms2Status: string
  hasMS3: boolean
  ms3Status: string

  csaRequired: boolean
  hasCSA: boolean
  csaStatus: string

  hasComm: boolean
  commStatus: string

  isModelMissing: boolean
  isDetailsMissing: boolean

  isFullyReady: boolean
  rawUnit: Unit
}

/** Status DONE-like */
export function isStatusDone(val: string | null | undefined): boolean {
  if (!val) return false
  const s = val.trim().toUpperCase()
  return s === 'DONE' || s === 'SELESAI' || s === 'SUDAH' || s === 'OK' || s === 'YES' || s === 'ADA'
}

/**
 * Client-side compliance evaluator — aligned with docs/BUSINESS_LOGIC.md
 * and public.v_unit_compliance (server source of truth).
 */
export function evaluateUnitCompliance(
  unit: Unit,
  process: UnitProcess | null | undefined,
  documents: UnitDocument[] = [],
  resolvedModel: string = '—'
): UnitComplianceStatus {
  const isImport2026 = unit.year_delivery === 2026
  const anyProc = process as Record<string, unknown> | null | undefined

  const arrivalVal = process?.arrival_check
  const hasArrival =
    isStatusDone(arrivalVal) ||
    !!(anyProc?.arrival_date as string | undefined)

  const pdiCheckVal = process?.pdi_check
  const hasPdiCheck = isStatusDone(pdiCheckVal)

  const pdiDoc = documents.find((d) => {
    const name = (d.document_types?.name || '').toUpperCase()
    const code = (d.document_types?.code || '').toUpperCase()
    return name.includes('PDI') || code.includes('PDI')
  })
  const hasPdiDocument = pdiDoc ? pdiDoc.status === 'uploaded' : false

  // Canonical DB columns: ms_check_1/2/3
  const ms1Val =
    (anyProc?.ms_check_1 as string) ||
    (anyProc?.ms1_check as string) ||
    (anyProc?.ms_1 as string)
  const ms2Val =
    (anyProc?.ms_check_2 as string) ||
    (anyProc?.ms2_check as string) ||
    (anyProc?.ms_2 as string)
  const ms3Val =
    (anyProc?.ms_check_3 as string) ||
    (anyProc?.ms3_check as string) ||
    (anyProc?.ms_3 as string)

  const hasMS1 = isStatusDone(ms1Val)
  const hasMS2 = isStatusDone(ms2Val)
  const hasMS3 = isStatusDone(ms3Val)

  const csaDoc = documents.find((d) => {
    const name = (d.document_types?.name || '').toUpperCase()
    const code = (d.document_types?.code || '').toUpperCase()
    return (
      code === 'CSA' ||
      name.includes('CSA') ||
      name.includes('CUSTOMER SERVICE AGREEMENT')
    )
  })
  const hasCSA = csaDoc ? csaDoc.status === 'uploaded' : false
  const csaStatus = !isImport2026
    ? 'Non-2026'
    : hasCSA
      ? 'Sudah CSA'
      : 'Wajib CSA (Belum)'

  const commVal = process?.comm_check
  const hasComm = isStatusDone(commVal)

  // Fully ready = sequential gates (server is_process_complete is stricter: needs sales+delivery)
  const isFullyReady =
    hasArrival && hasPdiCheck && hasComm && (!isImport2026 || hasCSA)

  return {
    unitId: unit.id,
    unitNumber: unit.unit_number || 'Tanpa Nomor',
    vin: unit.vin || '—',
    model: resolvedModel,
    cabang: unit.under_cabang || '—',
    customer: unit.customer || '—',
    yearDelivery: unit.year_delivery,
    isImport2026,

    hasArrival,
    arrivalStatus: hasArrival ? 'DONE' : arrivalVal || 'KOSONG',

    hasPdiCheck,
    pdiCheckStatus: hasPdiCheck ? 'DONE' : pdiCheckVal || 'KOSONG',
    hasPdiDocument,

    hasMS1,
    ms1Status: hasMS1 ? 'DONE' : 'BELUM',
    hasMS2,
    ms2Status: hasMS2 ? 'DONE' : 'BELUM',
    hasMS3,
    ms3Status: hasMS3 ? 'DONE' : 'BELUM',

    csaRequired: isImport2026,
    hasCSA,
    csaStatus,

    hasComm,
    commStatus: hasComm ? 'DONE' : commVal || 'KOSONG',

    isFullyReady,
    isModelMissing:
      !unit.model ||
      unit.model.trim() === '' ||
      unit.model === 'KOSONG' ||
      unit.model === 'Unknown' ||
      unit.model === '—',
    isDetailsMissing: !unit.customer || !unit.under_cabang || !unit.year_delivery,
    rawUnit: unit,
  }
}

export const PROCESS_BLOCKER_LABELS: Record<string, string> = {
  MISSING_ARRIVAL: 'Arrival kosong',
  MS1_OVERDUE: 'MS1 overdue (≥3 bln)',
  MS2_OVERDUE: 'MS2 overdue',
  MS3_OVERDUE: 'MS3 overdue',
  CSA_2026_MISSING: 'CSA 2026 belum',
  MISSING_PDI: 'PDI kosong',
  MISSING_DELIVERY: 'Delivery kosong',
  MISSING_COMM: 'Commissioning kosong',
  COMPLETE: 'Lengkap',
  IN_STOCK: 'Masih stock',
  IN_PROGRESS: 'Dalam proses',
}
