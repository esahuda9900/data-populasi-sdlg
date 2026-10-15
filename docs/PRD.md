# PRD — SDLG Monitor

**Status:** Draft (revisi expert)  
**Versi:** 1.1  
**Sebelumnya:** 1.0 (Oktober 2026)  
**Dibuat:** Oktober 2026  
**Revisi:** 15 Oktober 2026  
**Tim:** Internal ITU (PT Indo Traktor Utama)

**Changelog v1.0 → v1.1**
- Tambah Editable Fields Matrix + aturan immutable
- Perjelas keputusan enforcement cabang (UI-only di v1)
- Turunkan ekspektasi email notifikasi di P0 (free-tier realistis)
- Spec audit log
- Pecah Definition of Done per milestone
- Tambah acceptance criteria negatif
- Tambah urutan implementasi P0, success metrics, conflict data, permission matrix fitur sensitif
- Clarifikasi existing users saat RBAC diaktifkan
- Soft-delete policy & concurrent edit
- Dependency order antar item P0

---

## 1. Latar Belakang

Data unit SDLG tersebar di beberapa sumber (OLDP, AX, CRM, penjualan, SJU) dan sebelumnya tidak ada satu tempat terpusat untuk memonitor status dan kelengkapan dokumen per unit. Tim operasional harus cek manual ke masing-masing sistem, yang memakan waktu dan rawan missed gap.

SDLG Monitor dibangun untuk menjadi **satu sumber kebenaran operasional** bagi tim internal ITU dalam memonitor populasi unit, kelengkapan dokumen, dan pipeline operasional — **bukan** pengganti sistem sumber (OLDP/AX), melainkan layer monitoring + koreksi.

---

## 2. Tujuan Produk

- Menyediakan **dashboard terpusat** untuk monitoring ~4.100+ unit SDLG
- Mengidentifikasi **gap operasional** (unit belum selesai PDI, belum ada CSA, belum commissioning, dll.)
- Memudahkan **edit & koreksi data** langsung dari web tanpa harus masuk ke database
- Mendukung **kolaborasi tim** dengan role yang jelas (admin, operator, viewer)
- Menutup celah keamanan akses (signup terbuka → controlled account request)

**Bukan tujuan:**
- Menjadi sistem transaksi pengganti OLDP/AX
- Mobile app native
- Integrasi real-time API ke sistem pabrik

---

## 3. Target Pengguna

| Role | Siapa | Akses data | Akses aksi |
|------|-------|------------|------------|
| **Admin** | PIC data / pengelola sistem | Semua cabang | Full CRUD, manage user, approve request, bulk import, AI updater, hapus (soft) |
| **Operator** | Tim lapangan, sales, logistics | Semua cabang (lihat) | Edit unit (field yang diizinkan), tidak bisa manage user / hapus |
| **Viewer** | Manajemen / pihak yang perlu lihat | Semua cabang | Read-only + export CSV |

**Jumlah user estimasi:** 5–10 orang internal ITU  

### Keputusan enforcement cabang (penting)

> **v1 (P0–P1): Filter cabang hanya di UI.**  
> Operator/Viewer **bisa** melihat data semua cabang. Filter default bisa di-set ke cabang user, tapi tidak di-enforce di RLS.  
> Alasan: skala 5–10 user internal, complexity RLS per-cabang tinggi (unit sering pindah cabang), maintenance mahal.  
> **P2 (kalau user bertambah / ada kebutuhan compliance):** partisi ketat per cabang di RLS.

Ini menggantikan acceptance criteria lama yang bilang “Operator cabang A tidak bisa lihat data cabang B”.

---

## 4. Fitur Saat Ini (v1 — Sudah Live)

| Fitur | Keterangan |
|-------|------------|
| Login & Auth | Supabase Auth (signup publik masih terbuka — akan ditutup di P0) |
| Master Unit | List + detail unit, search & filter |
| Analisa Masalah | Dashboard gap operasional (sebagian tab) |
| Penjualan | Tracking data penjualan unit |
| Keberangkatan (SJU) | Tracking jadwal & status pengiriman |
| Commissioning | Monitoring status commissioning |
| AI Smart Updater | Parse input bahasa Indonesia informal → update data (Gemini + heuristic) |
| Bulk Import | Import data massal via CSV ke staging |
| Realtime Sync | Update otomatis via Supabase Realtime |
| Compliance Dashboard | Metrics gap unit berbasis view DB |
| Document Tracking | Status dokumen (CSA, PDI, dll.) per unit |
| Auto Deploy | GitHub Actions → GitHub Pages |

---

## 5. Roadmap Fitur (Prioritas)

### Urutan implementasi P0 (wajib diikuti)

```
1. Security foundation (user_profiles + tutup signup + RLS role-based minimal)
2. Account Request Flow + Admin tab (tanpa email dulu)
3. Inline Edit + Audit log
4. (Opsional cepat) Export CSV dasar
```

Alasan: Inline edit tanpa role = tetap berbahaya. Role tanpa cara onboard user baru = stuck.

---

### P0 — Kritikal (segera)

#### 5.1 Security Foundation + RBAC + Account Request Flow

**Masalah sekarang:** Tidak ada role. Semua yang login (termasuk lewat signup terbuka) bisa lihat & ubah semua data.

##### Bagian A — Tabel & role

- Tabel `user_profiles`:
  - `id` (FK auth.users)
  - `full_name`
  - `role`: `admin` | `operator` | `viewer`
  - `cabang` (text, untuk default filter UI; **bukan** filter keamanan di v1)
  - `phone` (opsional)
  - `is_active` (boolean)
  - `created_at`, `updated_at`
- Tabel `account_requests`:
  - `id`, `full_name`, `email`, `cabang`, `requested_role` (`operator`|`viewer` saja), `reason`, `phone`
  - `status`: `pending` | `approved` | `rejected`
  - `rejection_reason`, `reviewed_by`, `reviewed_at`
  - `created_at`

##### Bagian B — Form Pengajuan Akun (halaman Login)

- Signup publik **ditutup total** (Supabase Auth: disable public signup).
- Form request di halaman Login:
  - Nama lengkap, Email kantor, Cabang, Role diminta (Operator / Viewer saja), Alasan, HP (opsional)
- Setelah submit → status `pending` → pesan: *"Pengajuan kamu sudah diterima, tunggu konfirmasi dari admin."*
- Role **Admin tidak bisa diminta** lewat form.

##### Bagian C — Tab Account Management (khusus Admin)

- List request: pending / approved / rejected
- Admin bisa edit role atau cabang sebelum approve
- **Approve** → buat user di Auth (invite atau create) + insert `user_profiles` + set `is_active = true`
- **Reject** → wajib isi alasan
- Badge/counter merah di navigasi kalau ada pending

##### Bagian D — Notifikasi (realistis free-tier)

| Kejadian | Notifikasi v1 (P0) | P1 (opsional) |
|----------|--------------------|---------------|
| Request masuk | Badge counter di tab Admin | — |
| Request di-approve | User bisa login; admin bisa kasih tahu manual / copy link | Email otomatis |
| Request di-reject | Status terlihat jika user coba login ulang (atau admin hubungi) | Email + alasan |

> **Keputusan P0:** Email otomatis **bukan blocker**. Badge + flow approve/reject di UI dulu. Email masuk P1 jika dibutuhkan.

##### Bagian E — Existing users saat RBAC diaktifkan

- Saat migration pertama: buat 1 akun **admin** manual (chicken-and-egg — lihat §15).
- User yang sudah pernah signup sebelumnya: **tidak otomatis aktif**. Admin harus assign role lewat Account Management atau insert manual ke `user_profiles`.
- User tanpa row di `user_profiles` atau `is_active = false` → tidak bisa masuk app (redirect + pesan “Akun belum diaktifkan”).

##### Acceptance criteria (positif)

- [ ] Public signup ditutup
- [ ] Form request hanya menawarkan Operator / Viewer
- [ ] Request tersimpan `pending`
- [ ] Admin melihat badge pending
- [ ] Approve → user bisa login dengan role yang benar
- [ ] Reject → status rejected + alasan tersimpan
- [ ] User tanpa profile / inactive tidak bisa akses data

##### Acceptance criteria (negatif)

- [ ] Tidak ada cara daftar langsung jadi user aktif tanpa admin
- [ ] Form tidak menampilkan pilihan role Admin
- [ ] Viewer tidak melihat tombol Edit / Delete / Bulk Import / AI Updater
- [ ] Operator tidak bisa buka tab Account Management
- [ ] Operator tidak bisa hapus unit

##### RLS minimal (P0)

- Semua tabel publik penting: RLS ON
- Policy berdasarkan role di `user_profiles` (bukan per cabang):
  - **Viewer:** SELECT saja
  - **Operator:** SELECT + INSERT + UPDATE (bukan DELETE)
  - **Admin:** full termasuk DELETE (soft — lihat §5.1b)
- Staging schema tetap terisolasi (service_role only)

---

#### 5.1b Inline Edit Data di Web

**Masalah:** Koreksi data harus lewat Supabase dashboard.

##### Editable Fields Matrix

| Field / area | Admin | Operator | Viewer | Catatan |
|--------------|-------|----------|--------|---------|
| `status` | ✅ | ✅ | ❌ | Nilai: aktif, idle, maintenance, ready, sold, scrapped |
| `under_cabang` | ✅ | ✅ | ❌ | |
| `customer`, `location` | ✅ | ✅ | ❌ | |
| `year_delivery` | ✅ | ✅ | ❌ | Validasi tahun masuk akal (mis. 2018–2030) |
| Process flags (`arrival_check`, `pdi_check`, `comm_check`, `ms_check_1/2/3`) | ✅ | ✅ | ❌ | Nilai: DONE / KOSONG (atau setara) |
| Tanggal process terkait | ✅ | ✅ | ❌ | |
| Status dokumen (missing/pending/uploaded) | ✅ | ✅ | ❌ | |
| `model` (jika masih kosong / “Perlu Dilengkapi”) | ✅ | ✅ | ❌ | |
| **`vin`, `unit_number`** | ⚠️ Admin only + konfirmasi | ❌ | ❌ | **Immutable default** — ubah hanya admin + dialog konfirmasi keras |
| Hapus unit | Soft-delete (Admin) | ❌ | ❌ | Tidak hard-delete dari UI |

##### Perilaku edit

- Tombol **Edit** di detail unit (UnitDetailDrawer)
- Mode edit → ubah field → **Save** / **Cancel**
- Validasi client + server sebelum simpan
- Setelah save: update DB + tulis **audit log** (field yang berubah saja)
- Realtime: user lain yang buka unit yang sama melihat update (Supabase Realtime)
- **Concurrent edit:** last-write-wins + timestamp `updated_at`. Tidak ada optimistic locking ketat di v1 (skala kecil). Opsional: tampilkan “Data baru saja diubah orang lain” jika `updated_at` berubah saat save.

##### Soft-delete

- Unit tidak di-hard-delete dari UI.
- Admin bisa set status khusus atau flag `is_deleted` (kalau ditambah) / status `scrapped` dengan catatan.
- Hard-delete hanya lewat service_role / maintenance, bukan fitur harian.

##### Audit log (spec)

Setiap perubahan dari Inline Edit (dan idealnya AI Updater) menulis ke `audit_log`:

| Kolom | Isi |
|-------|-----|
| `table_name` | units / unit_process / unit_documents |
| `record_id` / `unit_id` | ID terkait |
| `field_name` | Nama field yang berubah |
| `old_value` / `new_value` | Text |
| `action` | UPDATE |
| `source` | `manual` \| `ai` \| `import` |
| `changed_by` | `auth.uid()` |
| `created_at` | now() |

- Hanya **Admin** yang wajib bisa lihat riwayat audit di UI (P0 bisa minimal: tercatat di DB; UI viewer audit = P1).
- Retention: simpan semua (volume kecil untuk 5–10 user). Tidak ada auto-purge di v1.

##### Acceptance criteria (positif)

- [ ] Klik Edit → ubah field yang diizinkan → Save → data update tanpa reload penuh
- [ ] Field immutable (`vin` / `unit_number`) tidak bisa diubah Operator; Admin butuh konfirmasi
- [ ] Setiap field yang berubah tercatat di `audit_log` dengan `changed_by`
- [ ] Cancel tidak menyimpan apa pun

##### Acceptance criteria (negatif)

- [ ] Viewer tidak melihat tombol Edit
- [ ] Operator tidak bisa menghapus unit
- [ ] Simpan dengan nilai status di luar enum ditolak

---

#### 5.1c Permission matrix fitur sensitif

| Fitur | Admin | Operator | Viewer |
|-------|-------|----------|--------|
| Lihat semua halaman data | ✅ | ✅ | ✅ |
| Inline edit | ✅ | ✅ | ❌ |
| Bulk Import | ✅ | ❌ | ❌ |
| AI Smart Updater | ✅ | ✅ (P0: boleh; review nanti) | ❌ |
| Account Management | ✅ | ❌ | ❌ |
| Export CSV | ✅ | ✅ | ✅ |
| Refresh OLDP Flags | ✅ | ❌ | ❌ |
| Soft-delete / status scrapped | ✅ | ❌ | ❌ |

> AI Updater untuk Operator di P0 **diizinkan** karena use-case lapangan. Jika nanti disalahgunakan, batasi ke Admin di P1.

---

### P1 — Penting (1–2 bulan)

#### 5.2 Lengkapi Tab Analisa

Sesuai `docs/BUSINESS_LOGIC.md` §13:

1. Complete OLDP  
2. Sold – gap cabang (WO comm)  
3. Sold – gap keberangkatan (SJU)  
4. Sold – gap PDI / CSA 2026  
5. SJU tanpa penjualan  
6. WO comm tanpa penjualan  
7. Stock – MS due  
8. Stock – arrival missing  
9. No BL  

Tiap tab menampilkan: next_action + PIC usulan (dari logic yang sudah ada).

#### 5.3 Export CSV per Tab

- Tombol export di setiap tab analisa (+ Master Unit)
- CSV UTF-8, nama file: `sdlg-{tab}-{YYYYMMDD}.csv`
- Boleh dipakai Admin / Operator / Viewer

#### 5.4 Hardening Security lanjutan

- Pastikan RLS aktif di **semua** tabel public yang dipakai app
- Hapus hardcode anon key dari source & workflow → GitHub Secrets saja
- Review policy DELETE / function `SECURITY DEFINER`
- (Opsional) Email notifikasi approve/reject jika SMTP/Edge Function siap

#### 5.5 Conflict data: manual edit vs import OLDP

- Saat refresh OLDP flags / re-import: field yang diisi manual **tidak boleh di-overwrite diam-diam** tanpa aturan.
- Aturan v1:  
  - Flag & tanggal dari OLDP → update lewat `refresh_unit_oldp_flags` / ETL  
  - Field operasional harian (`under_cabang`, `customer`, `location`, status process lokal) → **manual menang** sampai ada proses rekonsiliasi eksplisit  
- Dokumentasikan di BUSINESS_LOGIC jika perlu update.

---

### P2 — Nice to Have (3–6 bulan)

| Fitur | Keterangan |
|-------|------------|
| Tombol Refresh OLDP Flags | Admin trigger `refresh_unit_oldp_flags()` dari UI |
| PIC + Next Action assign | Assign PIC & catatan per unit |
| Notifikasi proaktif | Email/WhatsApp ke PIC untuk unit macet |
| Filter cabang tersimpan | Preferensi user |
| Enforcement cabang di RLS | Hanya jika skala/user/compliance membutuhkan |
| UI Audit log per unit | Timeline perubahan di drawer |
| Rate limit / konfirmasi ganda AI Updater | Cegah update massal salah |

---

## 6. Batasan Teknis & Constraint

| Item | Nilai |
|------|-------|
| Hosting | GitHub Pages (static) — gratis |
| Backend & DB | Supabase Free Tier |
| Repo | GitHub |
| Frontend | React + Vite (TypeScript) |
| AI | Google Gemini (opsional) + rule-heuristic fallback |
| Budget | Rp 0 |
| Target go-live P0 | Secepatnya — tidak ada deadline keras |

**Implikasi free tier:**

- DB ~500MB, Auth 50k MAU, bandwidth terbatas
- Realtime connection terbatas → jangan subscribe tabel berlebihan
- Custom email transactional tidak “gratis otomatis” → email = P1
- **Tidak ada backup otomatis** → export manual berkala wajib (lihat §15)

---

## 7. Out of Scope

- Aplikasi mobile native (iOS/Android)
- Integrasi real-time langsung ke OLDP atau AX
- Approval workflow multi-step
- Modul warranty mandiri (warranty hanya data, bukan fitur utama)
- Hard-delete massal dari UI
- Multi-tenant / multi-perusahaan

---

## 8. Risiko

| Risiko | Kemungkinan | Mitigasi |
|--------|-------------|----------|
| Data rusak karena edit tanpa validasi | Medium | Editable matrix + validasi + audit log |
| Akun bocor / signup terbuka | Tinggi (saat ini) | Tutup signup + Account Request (P0) |
| Free tier kehabisan quota | Low–Medium | Monitor usage, batasi realtime |
| Konflik edit manual vs import CSV/OLDP | Medium | Aturan “manual menang” untuk field operasional; dokumentasikan |
| AI Updater salah update | Medium | Preview hasil parse sebelum apply; audit `source=ai` |
| Migration salah → data corrupt | Medium | File migration + rollback + export sebelum merge |
| Admin pertama hilang akses | Low | Dokumentasikan admin pertama; recovery lewat Supabase dashboard |

---

## 9. Success Metrics (sederhana)

Karena internal tool, metrik cukup praktis:

| Metrik | Target kasar setelah P0 stabil |
|--------|--------------------------------|
| User aktif mingguan | ≥ 5 dari 5–10 user |
| Koreksi data lewat UI (bukan dashboard Supabase) | Mayoritas koreksi harian |
| Request akun diproses | < 2 hari kerja |
| Insiden akses tidak sah | 0 |
| Data loss karena migration/edit | 0 |

Tidak perlu analytics berat di v1.

---

## 10. Definition of Done (pecah per milestone)

### DoD — P0 Security & Access

- [ ] Public signup ditutup
- [ ] `user_profiles` + `account_requests` jalan
- [ ] Admin bisa approve/reject
- [ ] Role admin / operator / viewer membatasi aksi di UI + RLS dasar
- [ ] User tanpa profile tidak bisa akses app
- [ ] 1 admin pertama sudah di-setup manual

### DoD — P0 Inline Edit

- [ ] Edit field sesuai matrix dari UI
- [ ] Audit log tercatat per field
- [ ] Viewer tidak bisa edit
- [ ] VIN/unit_number tidak bisa diubah sembarangan

### DoD — Siap dipakai tim (v1.1)

- [ ] Semua item DoD P0 di atas
- [ ] 5–10 user internal onboard
- [ ] Export CSV minimal tersedia (boleh menyusul singkat setelah P0)
- [ ] Backup CSV berkala sudah dilakukan minimal sekali

---

## 11. Environment (Cara Deploy)

Satu environment production:

| Environment | Branch | URL | Database |
|-------------|--------|-----|----------|
| Production | `main` | GitHub Pages | Supabase project utama |
| Local | `feature/*` | localhost | **Project Supabase yang sama** — hati-hati |

**Aturan:**

- Tidak push langsung ke `main` — wajib Pull Request
- Branch `main` = yang sudah di-review
- Merge ke `main` → auto deploy Pages

```bash
git checkout -b feature/nama-fitur
```

---

## 12. Aturan Ubah Database (Migration)

Setiap perubahan struktur DB:

1. Tulis file SQL dulu:
   ```
   /supabase/migrations/YYYYMMDD_nama_perubahan.sql
   ```
2. Test di SQL Editor dulu
3. Sertakan di PR yang sama dengan kode terkait
4. Wajib ada rollback:

```sql
-- Rollback
DROP TABLE IF EXISTS public.user_profiles;
```

**Dilarang:**

- Ubah schema langsung di dashboard tanpa file SQL
- Hapus/rename kolom yang masih dipakai kode tanpa update kode sekalian

---

## 13. Cara Kerja di GitHub (Issue → PR → Merge)

```
Buat Issue → Buat Branch → AI/dev ngoding → Pull Request → Review manusia → Merge
```

AI boleh generate kode; **approve tetap manusia**.

### Template Issue

```
Judul: [P0] Tambah fitur inline edit unit

Apa yang mau dibuat/diperbaiki:
...

Hasil yang diharapkan:
...

Checklist selesai:
- [ ] ...

Label: priority: P0, type: feature
```

### Template Pull Request

```
Judul: feat: tambah inline edit untuk data unit

Apa yang berubah:
...

Closing issue: Closes #xx

Cara test:
1. ...
2. ...

Ada perubahan database (migration)? Ya / Tidak
Sudah di-test di local? Ya / Tidak

Screenshot: (jika UI)
```

### Label

| Label | Kapan |
|-------|--------|
| `priority: P0` | Harus sekarang |
| `priority: P1` | Minggu ini / bulan ini |
| `priority: P2` | Nice to have |
| `type: feature` | Fitur baru |
| `type: bug` | Rusak |
| `type: security` | Keamanan |
| `type: docs` | Dokumentasi |

---

## 14. Cara Review PR (Untuk Non-IT)

### Pertanyaan wajib ke AI sebelum approve

```
Jelaskan PR ini dalam bahasa awam:
1. Fitur/perubahan apa yang ditambahkan?
2. Apakah ada perubahan di database? Kalau ada, apa dampaknya ke data yang sudah ada?
3. Apa yang bisa salah? Apa risikonya ke data production?
4. Sudah di-test belum? Hasilnya gimana?
5. Kalau ternyata ada masalah setelah merge, cara baliknya gimana?
```

### Checklist review

- [ ] Penjelasan awam sudah dipahami
- [ ] Jika ada migration: dampak + rollback jelas
- [ ] Sudah di-test (kata AI + bukti)
- [ ] Sesuai issue (tidak ada scope diam-diam)
- [ ] Tidak ada dependency/package baru tanpa alasan

### Extra hati-hati jika

- Ada file `.sql`
- Menyentuh auth, RLS, `supabase.ts`
- Menyentuh > 5 file sekaligus

### Boleh review cepat jika

- Teks/UI copy saja
- Docs saja
- Typo

---

## 15. Hal Penting untuk Non-IT

### Setup Admin Pertama (sekali saja)

Akun sudah ada di Supabase Auth. Tinggal assign role admin:

1. Pastikan user `esahuda9900@gmail.com` sudah bisa login (sudah ada di Auth)
2. Setelah tabel `user_profiles` dibuat (migration P0), insert row:
   ```sql
   INSERT INTO public.user_profiles (id, full_name, role, is_active)
   SELECT id, 'Admin ITU', 'admin', true
   FROM auth.users
   WHERE email = 'esahuda9900@gmail.com';
   ```
3. Setelah itu semua request akun baru lewat flow normal (Account Request)

> **Admin pertama:** esahuda9900@gmail.com — setup tanggal: 15 Oktober 2026  
> (akun existing, di-assign role `admin` manual di `user_profiles`)

### Backup data (wajib)

Supabase free **tidak punya backup otomatis**.

- Export CSV tabel penting **minimal seminggu sekali**
- **Wajib export sebelum merge PR yang ada file SQL**
- Simpan di Google Drive / folder aman

Cara: Dashboard → Table Editor → Export CSV

### Hotfix production

1. Screenshot error
2. Minta AI hotfix minimal
3. Tetap lewat PR (review dipercepat)
4. Jangan hapus data langsung di dashboard saat panik
5. Jangan minta AI edit production DB tanpa PR

### Branch protection (setup sekali)

GitHub → Settings → Branches → Add rule untuk `main`:

- Require pull request before merging
- Require approvals: 1

---

## 16. Referensi internal

- `docs/BUSINESS_LOGIC.md` — sumber kebenaran proses operasional
- `docs/DATA_DICTIONARY.md` — staging vs public
- `supabase-schema.sql` — baseline schema & hardening awal
- Live app: https://esahuda9900.github.io/data-populasi-sdlg/

---

**Akhir dokumen PRD v1.1**
