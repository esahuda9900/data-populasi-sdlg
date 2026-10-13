# SDLG Population & Document Monitor

Web monitoring populasi unit SDLG + tracking dokumen, process (Arrival/PDI/Comm), sales, delivery, work orders, dan CRM.

**Stack gratis (free tier friendly)**  
- Frontend: Vite + React 18 + TypeScript + Tailwind → **GitHub Pages** (static, $0)  
- Backend/DB: **Supabase Free** (Postgres + Auth + Realtime + Edge Functions)  
- AI parse: Supabase Edge Function (Gemini optional) + rule-heuristic fallback (tanpa API key tetap jalan)

Live: https://esahuda9900.github.io/data-populasi-sdlg/

---

## Arsitektur (setelah hardening)

```
GitHub Pages (static SPA)
    │  Auth JWT
    ▼
Supabase Auth + Postgres (RLS)
    │
    ├── units / unit_process / unit_documents   ← core
    ├── unit_sales / unit_deliveries / work_orders / crm_records  ← ETL dari staging
    ├── audit_log                              ← siap tracking perubahan
    └── staging.*                              ← raw import (isolated)
    │
    └── Edge Function: ai-parse-update
            ├── Gemini (jika GEMINI_API_KEY secret ada)
            └── Rule-heuristic (selalu fallback)
```

## Setup lokal

1. Clone + `npm install`
2. Copy `.env.example` → `.env`:
   ```
   VITE_SUPABASE_URL=https://xluokufxwxurjykfrjav.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key dari dashboard>
   GEMINI_API_KEY=          # opsional, hanya untuk local Express AI
   ```
3. `npm run dev` (Express + Vite middleware)

## Database (ringkas)

| Tabel | Fungsi | Rows (approx) |
|-------|--------|---------------|
| units | Populasi unit | ~4.1k |
| unit_process | Arrival / MS / PDI / Comm | ~4.1k |
| unit_documents | Checklist dokumen | ~12k |
| unit_sales | Data penjualan | ~900+ |
| unit_deliveries | SJU / pengiriman | ~800+ |
| work_orders | WO dari AX | ~500+ |
| crm_records | Tarikan CRM | ~3.6k |
| audit_log | Riwayat perubahan | siap |
| staging.* | Raw Excel/CSV | isolated |

**Security:** RLS on, views SECURITY INVOKER, raw tables di schema `staging`, function search_path fixed.

## Fitur

- Login (Supabase Auth)
- Dashboard compliance metrics
- Units list + detail drawer
- Process tracking (Arrival / PDI / Comm / MS)
- Documents missing/pending/uploaded
- AI Smart Updater (bahasa Indonesia informal → structured update)
- Bulk import + realtime sync
- Deploy otomatis via GitHub Actions → Pages

## Free-tier tips

1. **Jangan** hardcode service_role key di frontend. Anon key + RLS cukup.
2. Edge Function `ai-parse-update` punya heuristic fallback → AI tetap berguna tanpa Gemini (0 cost).
3. Kalau butuh Gemini: set secret `GEMINI_API_KEY` di Supabase Edge Function secrets (Dashboard → Edge Functions → Secrets).
4. Aktifkan **Leaked Password Protection** di Auth → Providers (dashboard).
5. Staging tables tidak di-expose ke PostgREST public; akses hanya service_role untuk ETL ulang.
6. Limit realtime: hanya 3 tabel core di publication.

## Deploy

Push ke `main` → GitHub Actions build + deploy Pages otomatis.  
Env di workflow: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.

## Schema reference

Lihat `supabase-schema.sql` (sudah sync dengan production hardening).
