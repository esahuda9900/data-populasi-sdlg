/**
 * Client-side rule-heuristic parser for AI Smart Unit Updater.
 * Used when Express /api/ai-parse-update is unavailable (e.g. GitHub Pages static host).
 * Mirrors the fallback logic in server.ts so production still works without a backend.
 */

export type ContextUnit = {
  id?: string
  unit_number?: string | null
  vin?: string | null
  model?: string | null
  under_cabang?: string | null
  customer?: string | null
  location?: string | null
  status?: string | null
}

export type ParsedResult = {
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

export function parseWithRuleHeuristics(
  prompt: string,
  contextUnits: ContextUnit[] = []
): ParsedResult {
  const lower = prompt.toLowerCase()
  let targetIdentifier = ''
  let matchedUnit: ContextUnit | null = null

  for (const u of contextUnits) {
    if (u.unit_number && lower.includes(u.unit_number.toLowerCase())) {
      targetIdentifier = u.unit_number
      matchedUnit = u
      break
    }
    if (u.vin && lower.includes(u.vin.toLowerCase())) {
      targetIdentifier = u.vin
      matchedUnit = u
      break
    }
  }

  if (!targetIdentifier) {
    const unitMatch = prompt.match(/(?:unit|no\s*unit|vin)\s*[:#]?\s*([a-zA-Z0-9_\-]+)/i)
    if (unitMatch) {
      targetIdentifier = unitMatch[1]
    } else {
      const modelMatch = prompt.match(
        /(?:LG\d{3}[A-Z]*|E\d{3}[A-Z]*|G\d{3}[A-Z]*|RS\d{3}[A-Z]*|EX-\d+)(?:-[a-zA-Z0-9]+)?/i
      )
      if (modelMatch) {
        targetIdentifier = modelMatch[0]
      }
    }
  }

  if (targetIdentifier && !matchedUnit) {
    matchedUnit =
      contextUnits.find(
        (u) =>
          (u.unit_number &&
            u.unit_number.toLowerCase().includes(targetIdentifier.toLowerCase())) ||
          (u.vin && u.vin.toLowerCase().includes(targetIdentifier.toLowerCase()))
      ) || null
  }

  const processUpdates: Record<string, string> = {}
  const unitUpdates: Record<string, any> = {}
  const detectedActions: string[] = []

  // Commissioning (COMM)
  if (
    lower.includes('komisi') ||
    lower.includes('komisioning') ||
    lower.includes('commissioning') ||
    lower.includes('comm')
  ) {
    if (
      lower.includes('selesai') ||
      lower.includes('done') ||
      lower.includes('sudah') ||
      lower.includes('kirim') ||
      lower.includes('dikirim') ||
      lower.includes('beres') ||
      lower.includes('oke')
    ) {
      processUpdates.comm_check = 'DONE'
      detectedActions.push('Tandai Commissioning (COMM) Selesai (DONE)')
    } else if (lower.includes('batal') || lower.includes('belum') || lower.includes('reset')) {
      processUpdates.comm_check = 'KOSONG'
      detectedActions.push('Reset Commissioning (COMM) ke KOSONG')
    }
  }

  // Arrival
  if (
    lower.includes('arrival') ||
    lower.includes('tiba') ||
    lower.includes('kedatangan') ||
    lower.includes('sampai')
  ) {
    if (
      lower.includes('selesai') ||
      lower.includes('sudah') ||
      lower.includes('done') ||
      lower.includes('masuk')
    ) {
      processUpdates.arrival_check = 'DONE'
      detectedActions.push('Tandai Arrival Check Selesai (DONE)')
    }
  }

  // PDI
  if (lower.includes('pdi') || lower.includes('inspeksi') || lower.includes('pre-delivery')) {
    if (
      lower.includes('selesai') ||
      lower.includes('sudah') ||
      lower.includes('done') ||
      lower.includes('lulus') ||
      lower.includes('beres')
    ) {
      processUpdates.pdi_check = 'DONE'
      detectedActions.push('Tandai PDI Check Selesai (DONE)')
    }
  }

  // Maintenance Stock MS 1/2/3
  if (lower.includes('ms 1') || lower.includes('ms1') || lower.includes('maintenance stock 1')) {
    processUpdates.ms_check_1 = 'DONE'
    detectedActions.push('Tandai Maintenance Stock 1 Selesai (DONE)')
  }
  if (lower.includes('ms 2') || lower.includes('ms2') || lower.includes('maintenance stock 2')) {
    processUpdates.ms_check_2 = 'DONE'
    detectedActions.push('Tandai Maintenance Stock 2 Selesai (DONE)')
  }
  if (lower.includes('ms 3') || lower.includes('ms3') || lower.includes('maintenance stock 3')) {
    processUpdates.ms_check_3 = 'DONE'
    detectedActions.push('Tandai Maintenance Stock 3 Selesai (DONE)')
  }

  // Status operasional
  if (lower.includes('status')) {
    if (lower.includes('aktif') || lower.includes('operasi') || lower.includes('jalan')) {
      unitUpdates.status = 'aktif'
      detectedActions.push('Ubah Status Operasional ke Aktif')
    } else if (lower.includes('idle') || lower.includes('standby')) {
      unitUpdates.status = 'idle'
      detectedActions.push('Ubah Status Operasional ke Idle')
    } else if (
      lower.includes('maintenance') ||
      lower.includes('rusak') ||
      lower.includes('perbaikan') ||
      lower.includes('service')
    ) {
      unitUpdates.status = 'maintenance'
      detectedActions.push('Ubah Status Operasional ke Maintenance')
    } else if (lower.includes('ready') || lower.includes('siap')) {
      unitUpdates.status = 'ready'
      detectedActions.push('Ubah Status Operasional ke Ready')
    }
  }

  // Cabang
  const cabangMatch = prompt.match(/(?:cabang|branch)\s+([a-zA-Z]+)/i)
  if (cabangMatch) {
    unitUpdates.under_cabang = cabangMatch[1].toUpperCase()
    detectedActions.push(`Pindahkan Cabang ke ${cabangMatch[1].toUpperCase()}`)
  }

  // Lokasi
  const lokasiMatch = prompt.match(
    /(?:lokasi|di yard|di site|ke yard|ke site)\s+([a-zA-Z0-9\s\-]+?)(?:,|$|\.|\bdengan\b|\bstatus\b)/i
  )
  if (lokasiMatch) {
    unitUpdates.location = lokasiMatch[1].trim()
    detectedActions.push(`Perbarui Lokasi ke: ${lokasiMatch[1].trim()}`)
  }

  // Customer
  const custMatch = prompt.match(
    /(?:customer|pelanggan|pembeli)\s+([a-zA-Z0-9\s\.\-]+?)(?:,|$|\.|\btanggal\b|\bdan\b)/i
  )
  if (custMatch) {
    unitUpdates.customer = custMatch[1].trim()
    detectedActions.push(`Perbarui Customer: ${custMatch[1].trim()}`)
  }

  // Tahun delivery
  const yearMatch = prompt.match(/(?:tahun|delivery|bl)\s*[:=]?\s*(202[0-9])/i)
  if (yearMatch) {
    unitUpdates.year_delivery = parseInt(yearMatch[1], 10)
    detectedActions.push(`Perbarui Tahun Delivery/BL: ${yearMatch[1]}`)
  }

  return {
    targetIdentifier: targetIdentifier || 'Unit Tidak Spesifik',
    matchedUnitNumber: matchedUnit ? matchedUnit.unit_number || targetIdentifier : targetIdentifier,
    matchedVin: matchedUnit ? matchedUnit.vin || null : null,
    matchedUnitId: matchedUnit?.id || null,
    confidence: matchedUnit ? 'high' : targetIdentifier ? 'medium' : 'low',
    summaryExplanation:
      detectedActions.length > 0
        ? `Berhasil mendeteksi perubahan: ${detectedActions.join('; ')}`
        : 'Perintah terdeteksi, namun tidak ada perubahan spesifik yang cocok dengan aturan.',
    unitUpdates,
    processUpdates,
    engine: 'Rule-Heuristic Parser (Client / GH Pages)',
  }
}

/**
 * Try backend API first; on failure (404/network on static host) use client parser.
 */
export async function parseAiUpdate(
  prompt: string,
  contextUnits: ContextUnit[]
): Promise<ParsedResult> {
  try {
    const res = await fetch('/api/ai-parse-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        contextUnits: contextUnits.map((u) => ({
          id: u.id,
          unit_number: u.unit_number,
          vin: u.vin,
          model: u.model,
          under_cabang: u.under_cabang,
          customer: u.customer,
          location: u.location,
          status: u.status,
        })),
      }),
    })

    if (res.ok) {
      const data = await res.json()
      if (data && (data.targetIdentifier || data.unitUpdates || data.processUpdates)) {
        return data as ParsedResult
      }
    }
  } catch {
    // Static host / no backend — fall through
  }

  return parseWithRuleHeuristics(prompt, contextUnits)
}
