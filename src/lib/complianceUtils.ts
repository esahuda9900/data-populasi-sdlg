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

  // 1. Arrival
  hasArrival: boolean
  arrivalStatus: string

  // 2. PDI
  hasPdiCheck: boolean
  pdiCheckStatus: string
  hasPdiDocument: boolean

  // 3. Maintenance Stock 1, 2, 3
  hasMS1: boolean
  ms1Status: string
  hasMS2: boolean
  ms2Status: string
  hasMS3: boolean
  ms3Status: string

  // 4. CSA (Customer Service Agreement) for 2026 import
  csaRequired: boolean
  hasCSA: boolean
  csaStatus: string

  // 5. Commissioning (COMM)
  hasComm: boolean
  commStatus: string

  // Overall readiness
  isFullyReady: boolean
  rawUnit: Unit
}

/**
 * Checks if a string indicates completion ('DONE', 'SELESAI', 'SUDAH', 'OK', etc.)
 */
export function isStatusDone(val: string | null | undefined): boolean {
  if (!val) return false
  const s = val.trim().toUpperCase()
  return s === 'DONE' || s === 'SELESAI' || s === 'SUDAH' || s === 'OK' || s === 'YES' || s === 'ADA'
}

/**
 * Evaluates the full compliance and milestone status for a unit
 */
export function evaluateUnitCompliance(
  unit: Unit,
  process: UnitProcess | null | undefined,
  documents: UnitDocument[] = [],
  resolvedModel: string = '—'
): UnitComplianceStatus {
  const isImport2026 = unit.year_delivery === 2026

  // 1. Arrival Check
  const arrivalVal = process?.arrival_check
  const hasArrival = isStatusDone(arrivalVal)

  // 2. PDI Process & Document
  const pdiCheckVal = process?.pdi_check
  const hasPdiCheck = isStatusDone(pdiCheckVal)

  // Look for PDI document in unit_documents
  const pdiDoc = documents.find((d) => {
    const name = (d.document_types?.name || '').toUpperCase()
    const code = (d.document_types?.code || '').toUpperCase()
    return name.includes('PDI') || code.includes('PDI')
  })
  const hasPdiDocument = pdiDoc ? pdiDoc.status === 'uploaded' : false

  // 3. Maintenance Stock 1, 2, 3
  // Check from unit_process (any ms fields) or documents
  const anyProc = process as Record<string, any> | null | undefined
  const ms1Val = anyProc?.ms1_check || anyProc?.ms_1 || anyProc?.maintenance_stock_1
  const ms2Val = anyProc?.ms2_check || anyProc?.ms_2 || anyProc?.maintenance_stock_2
  const ms3Val = anyProc?.ms3_check || anyProc?.ms_3 || anyProc?.maintenance_stock_3

  const ms1Doc = documents.find((d) => {
    const name = (d.document_types?.name || '').toUpperCase()
    return name.includes('MS 1') || name.includes('MS1') || name.includes('MAINTENANCE STOCK 1')
  })
  const ms2Doc = documents.find((d) => {
    const name = (d.document_types?.name || '').toUpperCase()
    return name.includes('MS 2') || name.includes('MS2') || name.includes('MAINTENANCE STOCK 2')
  })
  const ms3Doc = documents.find((d) => {
    const name = (d.document_types?.name || '').toUpperCase()
    return name.includes('MS 3') || name.includes('MS3') || name.includes('MAINTENANCE STOCK 3')
  })

  const hasMS1 = isStatusDone(ms1Val) || (ms1Doc ? ms1Doc.status === 'uploaded' : false)
  const hasMS2 = isStatusDone(ms2Val) || (ms2Doc ? ms2Doc.status === 'uploaded' : false)
  const hasMS3 = isStatusDone(ms3Val) || (ms3Doc ? ms3Doc.status === 'uploaded' : false)

  // 4. CSA for Import 2026
  const csaDoc = documents.find((d) => {
    const name = (d.document_types?.name || '').toUpperCase()
    const code = (d.document_types?.code || '').toUpperCase()
    return (
      name.includes('CSA') ||
      code.includes('CSA') ||
      name.includes('CUSTOMER SERVICE AGREEMENT') ||
      name.includes('SERVICE AGREEMENT')
    )
  })
  const hasCSA = csaDoc ? csaDoc.status === 'uploaded' : false
  const csaStatus = !isImport2026
    ? 'Non-2026'
    : hasCSA
    ? 'Sudah CSA'
    : 'Wajib CSA (Belum)'

  // 5. Commissioning Check
  const commVal = process?.comm_check
  const hasComm = isStatusDone(commVal)

  // Overall readiness
  const isFullyReady =
    hasArrival &&
    hasPdiCheck &&
    hasPdiDocument &&
    hasComm &&
    (!isImport2026 || hasCSA)

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
    rawUnit: unit,
  }
}
