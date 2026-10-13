import express, { Request, Response } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI } from '@google/genai'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())

// Rule-based fallback parser in case Gemini API key is not configured
function parseWithRuleHeuristics(prompt: string, contextUnits: any[] = []) {
  const lower = prompt.toLowerCase()
  let targetIdentifier = ''
  let matchedUnit: any = null

  // 1. Extract Unit Identifier (e.g., "LG956L-01", "LG956L", "EX-04", "E6210F", "unit 03", "vin ...")
  // First test against contextUnits
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

  // Regex extraction if not matched directly
  if (!targetIdentifier) {
    const unitMatch = prompt.match(/(?:unit|no\s*unit|vin)\s*[:#]?\s*([a-zA-Z0-9_\-]+)/i)
    if (unitMatch) {
      targetIdentifier = unitMatch[1]
    } else {
      const modelMatch = prompt.match(/(?:LG\d{3}[A-Z]*|E\d{3}[A-Z]*|G\d{3}[A-Z]*|RS\d{3}[A-Z]*)(?:-[a-zA-Z0-9]+)?/i)
      if (modelMatch) {
        targetIdentifier = modelMatch[0]
      }
    }
  }

  // Try matching against contextUnits loosely
  if (targetIdentifier && !matchedUnit) {
    matchedUnit = contextUnits.find(
      (u) =>
        (u.unit_number && u.unit_number.toLowerCase().includes(targetIdentifier.toLowerCase())) ||
        (u.vin && u.vin.toLowerCase().includes(targetIdentifier.toLowerCase()))
    )
  }

  const processUpdates: Record<string, string> = {}
  const unitUpdates: Record<string, any> = {}
  const detectedActions: string[] = []

  // Check Commissioning (COMM)
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

  // Check Arrival
  if (lower.includes('arrival') || lower.includes('tiba') || lower.includes('kedatangan') || lower.includes('sampai')) {
    if (lower.includes('selesai') || lower.includes('sudah') || lower.includes('done') || lower.includes('masuk')) {
      processUpdates.arrival_check = 'DONE'
      detectedActions.push('Tandai Arrival Check Selesai (DONE)')
    }
  }

  // Check PDI
  if (lower.includes('pdi') || lower.includes('inspeksi') || lower.includes('pre-delivery')) {
    if (lower.includes('selesai') || lower.includes('sudah') || lower.includes('done') || lower.includes('lulus') || lower.includes('beres')) {
      processUpdates.pdi_check = 'DONE'
      detectedActions.push('Tandai PDI Check Selesai (DONE)')
    }
  }

  // Check Maintenance Stock (MS 1, 2, 3) — MUST match unit_process columns: ms_check_1/2/3
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

  // Check Status Operasional
  if (lower.includes('status')) {
    if (lower.includes('aktif') || lower.includes('operasi') || lower.includes('jalan')) {
      unitUpdates.status = 'aktif'
      detectedActions.push('Ubah Status Operasional ke Aktif')
    } else if (lower.includes('idle') || lower.includes('standby')) {
      unitUpdates.status = 'idle'
      detectedActions.push('Ubah Status Operasional ke Idle')
    } else if (lower.includes('maintenance') || lower.includes('rusak') || lower.includes('perbaikan') || lower.includes('service')) {
      unitUpdates.status = 'maintenance'
      detectedActions.push('Ubah Status Operasional ke Maintenance')
    } else if (lower.includes('ready') || lower.includes('siap')) {
      unitUpdates.status = 'ready'
      detectedActions.push('Ubah Status Operasional ke Ready')
    }
  }

  // Check Cabang (e.g. "cabang balikpapan", "ke cabang surabaya")
  const cabangMatch = prompt.match(/(?:cabang|branch)\s+([a-zA-Z]+)/i)
  if (cabangMatch) {
    unitUpdates.under_cabang = cabangMatch[1].toUpperCase()
    detectedActions.push(`Pindahkan Cabang ke ${cabangMatch[1].toUpperCase()}`)
  }

  // Check Lokasi
  const lokasiMatch = prompt.match(/(?:lokasi|di yard|di site|ke yard|ke site)\s+([a-zA-Z0-9\s\-]+?)(?:,|$|\.|\bdengan\b|\bstatus\b)/i)
  if (lokasiMatch) {
    unitUpdates.location = lokasiMatch[1].trim()
    detectedActions.push(`Perbarui Lokasi ke: ${lokasiMatch[1].trim()}`)
  }

  // Check Customer
  const custMatch = prompt.match(/(?:customer|pelanggan|pembeli)\s+([a-zA-Z0-9\s\.\-]+?)(?:,|$|\.|\btanggal\b|\bdan\b)/i)
  if (custMatch) {
    unitUpdates.customer = custMatch[1].trim()
    detectedActions.push(`Perbarui Customer: ${custMatch[1].trim()}`)
  }

  // Check Year
  const yearMatch = prompt.match(/(?:tahun|delivery|bl)\s*[:=]?\s*(202[0-9])/i)
  if (yearMatch) {
    unitUpdates.year_delivery = parseInt(yearMatch[1], 10)
    detectedActions.push(`Perbarui Tahun Delivery/BL: ${yearMatch[1]}`)
  }

  return {
    targetIdentifier: targetIdentifier || 'Unit Tidak Spesifik',
    matchedUnitNumber: matchedUnit ? matchedUnit.unit_number : targetIdentifier,
    matchedVin: matchedUnit ? matchedUnit.vin : null,
    matchedUnitId: matchedUnit ? matchedUnit.id : null,
    confidence: matchedUnit ? 'high' : targetIdentifier ? 'medium' : 'low',
    summaryExplanation:
      detectedActions.length > 0
        ? `Berhasil mendeteksi perubahan: ${detectedActions.join('; ')}`
        : 'Perintah terdeteksi, namun tidak ada perubahan spesifik yang cocok dengan aturan.',
    unitUpdates,
    processUpdates,
    engine: 'Rule-Heuristic Parser (Fallback)',
  }
}

// POST endpoint: /api/ai-parse-update
app.post('/api/ai-parse-update', async (req: Request, res: Response) => {
  try {
    const { prompt, contextUnits = [] } = req.body

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt teks wajib diisi.' })
    }

    const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim()

    // If Gemini API Key is available, use Gemini 3.8 Flash for intelligent semantic parsing
    if (apiKey && apiKey.length > 5) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        })

        // Provide slice of known units context to assist matching
        const contextSummary = contextUnits.slice(0, 50).map((u: any) => ({
          id: u.id,
          unit_number: u.unit_number,
          vin: u.vin,
          model: u.model,
          under_cabang: u.under_cabang,
          status: u.status,
        }))

        const systemInstruction = `Anda adalah asisten cerdas armada alat berat SDLG (PT Indotruck Utama).
Tugas Anda adalah memahami instruksi teks bahasa Indonesia informal atau formal dari personil lapangan/mekanik/koordinator cabang, kemudian mem-parsing menjadi pembaruan database terstruktur.

Daftar field target:
1. Tabel 'units':
   - under_cabang: string (misal: "JAKARTA", "BALIKPAPAN", "SURABAYA", "BANJARMASIN", "MAKASSAR", "SAMARINDA", dll)
   - customer: string (nama PT atau pembeli)
   - location: string (lokasi yard atau site)
   - year_delivery: number (tahun B/L atau pengiriman, misal 2024, 2025, 2026)
   - status: "aktif" | "idle" | "maintenance" | "ready" | "sold" | "scrapped"
   - serial_number: string
   - device_number: string (nomor GPS/telematics)
2. Tabel 'unit_process':
   - arrival_check: "DONE" | "KOSONG"
   - pdi_check: "DONE" | "KOSONG"
   - comm_check: "DONE" | "KOSONG" (Commissioning)
   - ms_check_1: "DONE" | "KOSONG"
   - ms_check_2: "DONE" | "KOSONG"
   - ms_check_3: "DONE" | "KOSONG"

Format JSON yang HARUS dikembalikan:
{
  "targetIdentifier": "No Unit atau VIN yang disebutkan (misal: 'LG956L-03', 'EX-04')",
  "matchedUnitNumber": "No unit yang paling cocok dari daftar konteks, atau null jika tidak ada konteks",
  "matchedVin": "VIN yang paling cocok atau null",
  "matchedUnitId": "ID unit dari konteks jika cocok, atau null",
  "confidence": "high" | "medium" | "low",
  "summaryExplanation": "Penjelasan singkat dalam bahasa Indonesia tentang apa saja data yang akan diperbarui",
  "unitUpdates": {
    "under_cabang"?: string,
    "customer"?: string,
    "location"?: string,
    "year_delivery"?: number,
    "status"?: "aktif" | "idle" | "maintenance" | "ready" | "sold" | "scrapped",
    "serial_number"?: string,
    "device_number"?: string
  },
  "processUpdates": {
    "arrival_check"?: "DONE" | "KOSONG",
    "pdi_check"?: "DONE" | "KOSONG",
    "comm_check"?: "DONE" | "KOSONG",
    "ms_check_1"?: "DONE" | "KOSONG",
    "ms_check_2"?: "DONE" | "KOSONG",
    "ms_check_3"?: "DONE" | "KOSONG"
  }
}`

        const promptContent = `Instruksi Pengguna: "${prompt}"

Daftar Konteks Unit Terkini di Sistem:
${JSON.stringify(contextSummary, null, 2)}`

        const withTimeout = <T>(promise: Promise<T>, ms = 4500): Promise<T> =>
          Promise.race([
            promise,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error('AI request timeout')), ms)),
          ])

        let response: any = null
        try {
          response = await withTimeout(
            ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: promptContent,
              config: {
                responseMimeType: 'application/json',
                systemInstruction,
              },
            }),
            4000
          )
        } catch (_modelErr: any) {
          // If primary model has a temporary capacity issue or times out, attempt fallback
          try {
            response = await withTimeout(
              ai.models.generateContent({
                model: 'gemini-flash-latest',
                contents: promptContent,
                config: {
                  responseMimeType: 'application/json',
                  systemInstruction,
                },
              }),
              3000
            )
          } catch (_fallbackErr: any) {
            // Silently fall through to rule heuristics
          }
        }

        if (response && response.text) {
          try {
            const rawText = response.text.trim()
            const parsed = JSON.parse(rawText)
            if (parsed && (parsed.targetIdentifier || parsed.unitUpdates || parsed.processUpdates)) {
              return res.json({
                ...parsed,
                engine: 'Gemini 3.8 Flash (AI Semantic)',
              })
            }
          } catch (_parseErr) {
            // Invalid JSON from LLM, will fall back below
          }
        }

        // If Gemini did not return a valid result, fall back to rule heuristics
        const fallbackResult = parseWithRuleHeuristics(prompt, contextUnits)
        return res.json(fallbackResult)
      } catch (_aiError: any) {
        // Fallback silently to rule heuristics if API is temporarily unavailable
        const fallbackResult = parseWithRuleHeuristics(prompt, contextUnits)
        return res.json(fallbackResult)
      }
    }

    // If no API Key is present, use high-precision rule-based parser
    const result = parseWithRuleHeuristics(prompt, contextUnits)
    return res.json(result)
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Terjadi kesalahan saat memproses teks AI.' })
  }
})

// Setup Vite Dev Middleware or Static File Serving
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production'

  // Root redirect to /data-populasi-sdlg/
  app.get('/', (req, res) => {
    res.redirect('/data-populasi-sdlg/')
  })

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.resolve(__dirname, 'dist')
    app.use('/data-populasi-sdlg', express.static(distPath))
    app.use(express.static(distPath))
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'))
    })
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[SDLG Server] running on http://0.0.0.0:${port}`)
  })
}

startServer()
