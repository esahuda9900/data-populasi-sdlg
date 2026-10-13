# SDLG Population & Document Monitor

Web monitoring populasi unit SDLG + tracking dokumen yang belum di-upload.

## Stack
- **Frontend**: Vite + React 18 + TypeScript + Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL + Auth + Realtime)
- **Deploy**: GitHub Pages

## Setup Lokal

1. Clone repo
2. `npm install`
3. Copy `.env.example` → `.env` dan isi key Supabase:
   ```
   VITE_SUPABASE_URL=https://xluokufxwxurjykfrjav.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon_key>
   ```
4. `npm run dev`

## Database Schema
- `units` — data populasi unit
- `document_types` — master jenis dokumen (BPKB, STNK, Asuransi, dll)
- `unit_documents` — status dokumen per unit (missing / pending / uploaded)
- `import_logs` — riwayat upload CSV

## Fitur Utama
- Login (Supabase Auth)
- Dashboard overview
- Daftar unit
- Tracking dokumen yang belum di-upload (fokus proses)

## Deploy ke GitHub Pages
Setelah build (`npm run build`), push folder `dist` ke branch `gh-pages` atau gunakan GitHub Actions.
