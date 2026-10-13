import { Unit } from './supabase'

/**
 * Standard list of popular SDLG machinery models
 */
export const POPULAR_SDLG_MODELS = [
  // Wheel Loaders
  'LG956L',
  'LG953N',
  'LG936L',
  'LG938L',
  'LG958L',
  'LG968L',
  'L956H',
  'L958H',
  'L936H',
  'L953H',
  'L975F',
  'ZL50GN',
  // Excavators
  'E6210F',
  'E6205F',
  'E6250F',
  'E6300F',
  'E6360F',
  'E6150F',
  'E660FL',
  'E6500F',
  'LG6210',
  'LG6150',
  // Motor Graders
  'G9190',
  'G9220',
  'G9165',
  'G9138',
  'G9290',
  // Compactors / Road Rollers
  'RS8140',
  'RS7260',
  'RS8200',
  'RS8220',
  'RD730',
  // Backhoe Loaders
  'B877F',
  'LGB877',
]

/**
 * Regex to extract SDLG model pattern from any string (unit number, VIN, serial, or raw notes)
 * Matches: LG956L, L956H, E6210F, G9190, RS8140, B877F, ZL50GN, etc.
 */
const SDLG_MODEL_REGEX = /(?:SDLG[-_\s]*)?(LG[0-9]{3,4}[A-Z]?|L[0-9]{3,4}[A-Z]?|E[0-9]{3,4}[A-Z]?|G[0-9]{4}[A-Z]?|RS[0-9]{4}[A-Z]?|RD[0-9]{3}[A-Z]?|B[0-9]{3}[A-Z]?|MT[0-9]{2}[A-Z]?|ZL[0-9]{2}[A-Z]*)/i

/**
 * Cleans and normalizes model string (removes noise, standardizes uppercase)
 */
function normalizeModelString(raw: string): string {
  const cleaned = raw.trim().toUpperCase()
  if (
    cleaned === '—' ||
    cleaned === '-' ||
    cleaned === 'NULL' ||
    cleaned === 'UNDEFINED' ||
    cleaned === 'UNKNOWN' ||
    cleaned === 'KOSONG' ||
    cleaned === 'N/A' ||
    cleaned === 'NONE' ||
    cleaned === 'BELUM ADA'
  ) {
    return ''
  }
  return cleaned
}

export interface ResolvedModelResult {
  model: string
  isAutoInferred: boolean
  sourceField?: 'model' | 'variant' | 'group_type' | 'unit_number' | 'vin' | 'serial_number'
}

/**
 * Intelligently resolves the actual machine model for an SDLG unit:
 * 1. Checks explicit `unit.model`
 * 2. Checks `unit.variant` (often filled during CSV import)
 * 3. Checks `unit.group_type`
 * 4. Extracts matching SDLG model code from `unit.unit_number` (e.g. "LG956L-01" -> "LG956L")
 * 5. Extracts matching SDLG model code from `unit.vin` or `unit.serial_number`
 */
export function resolveUnitModel(unit: Partial<Unit> | null | undefined): ResolvedModelResult {
  if (!unit) {
    return { model: 'Belum Terdata', isAutoInferred: false }
  }

  // 1. Check explicit model
  if (unit.model) {
    const norm = normalizeModelString(unit.model)
    if (norm) {
      return { model: norm, isAutoInferred: false, sourceField: 'model' }
    }
  }

  // 2. Check variant
  if (unit.variant) {
    const norm = normalizeModelString(unit.variant)
    if (norm) {
      return { model: norm, isAutoInferred: true, sourceField: 'variant' }
    }
  }

  // 3. Check group_type
  if (unit.group_type) {
    const norm = normalizeModelString(unit.group_type)
    if (norm) {
      const match = norm.match(SDLG_MODEL_REGEX)
      if (match && match[1]) {
        return { model: match[1].toUpperCase(), isAutoInferred: true, sourceField: 'group_type' }
      }
      return { model: norm, isAutoInferred: true, sourceField: 'group_type' }
    }
  }

  // 4. Try extracting from unit_number (common: "LG956L-04", "SDLG 956L", "E6210F#01")
  if (unit.unit_number) {
    const match = unit.unit_number.match(SDLG_MODEL_REGEX)
    if (match && match[1]) {
      return { model: match[1].toUpperCase(), isAutoInferred: true, sourceField: 'unit_number' }
    }
  }

  // 5. Try extracting from VIN
  if (unit.vin) {
    const match = unit.vin.match(SDLG_MODEL_REGEX)
    if (match && match[1]) {
      return { model: match[1].toUpperCase(), isAutoInferred: true, sourceField: 'vin' }
    }
  }

  // 6. Try extracting from serial number
  if (unit.serial_number) {
    const match = unit.serial_number.match(SDLG_MODEL_REGEX)
    if (match && match[1]) {
      return { model: match[1].toUpperCase(), isAutoInferred: true, sourceField: 'serial_number' }
    }
  }

  return { model: 'Perlu Dilengkapi', isAutoInferred: true }
}

/**
 * Scans all units with missing or unknown models in Supabase,
 * infers their model using pattern heuristics, and saves the resolved models permanently to the database.
 */
export async function batchSyncMissingModels(
  supabaseClient: any,
  onProgress?: (current: number, total: number) => void
): Promise<{ totalScanned: number; updatedCount: number; unresolvableCount: number }> {
  // 1. Fetch units with missing or empty models
  const { data: unitsToFix, error } = await supabaseClient
    .from('units')
    .select('id, unit_number, vin, model, group_type, variant, serial_number')
    .or('model.is.null,model.eq.,model.eq.KOSONG,model.eq.Unknown,model.eq.—,model.eq.NULL')
    .limit(2000)

  if (error) throw error
  if (!unitsToFix || unitsToFix.length === 0) {
    return { totalScanned: 0, updatedCount: 0, unresolvableCount: 0 }
  }

  let updatedCount = 0
  let unresolvableCount = 0
  const total = unitsToFix.length

  for (let i = 0; i < total; i++) {
    const u = unitsToFix[i]
    const resolved = resolveUnitModel(u)

    if (resolved.model && resolved.model !== 'Perlu Dilengkapi') {
      try {
        const { error: updateError } = await supabaseClient
          .from('units')
          .update({ model: resolved.model.toUpperCase() })
          .eq('id', u.id)

        if (!updateError) {
          updatedCount++
        }
      } catch (err) {
        console.warn(`Failed to update unit ${u.id}:`, err)
      }
    } else {
      unresolvableCount++
    }

    if (onProgress && (i % 5 === 0 || i === total - 1)) {
      onProgress(i + 1, total)
    }
  }

  return { totalScanned: total, updatedCount, unresolvableCount }
}
