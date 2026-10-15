# ISSUE — Account Management v2.1

**Proyek:** SDLG Monitor  
**Scope:** Detail User, Edit User, Reset Password, Force Logout, Soft/Hard Delete, Arsip, Polish  
**Status dokumen:** 15 Oct 2026  
**Planning sumber:** Planning FINAL v2.1 (LOCKED)

---

## Ringkasan status

| Area | Progress |
|------|----------|
| Fondasi DB (email, soft delete, backup, view, RPC) | ✅ Selesai |
| Edge Function `admin-user-actions` | ✅ Selesai |
| Detail user `/akun/users/:id` | ✅ Selesai |
| Edit + optimistic lock | ✅ Selesai |
| Reset password + generate link + force logout | ✅ Selesai |
| Soft delete → arsip → restore | ✅ Selesai |
| Hard delete (grace 30 hari) | ✅ Selesai |
| Tab Arsip + filter Users + pagination | ✅ Selesai |
| Badge pending sidebar (poll + realtime) | ✅ Selesai |
| Reviewer = nama | ✅ Selesai |
| Rate limit + activity log | ✅ Selesai |
| Notifikasi email ke user | ❌ Belum (tech debt) |
| CORS whitelist domain | ❌ Belum (masih `*`) |
| 2FA / bulk / GDPR export | ❌ Tech debt |

**Verdict:** Core DoD v2.1 **sudah diimplementasi**. Sisa = tech debt & polish opsional.

---

## Bagian 0 — Keputusan lead (terkunci)

| # | Pertanyaan | Keputusan |
|---|------------|-----------|
| 1 | Soft only atau soft → hard? | Soft → hard, grace **30 hari** |
| 2 | Siapa boleh hapus? | Admin aktif; hard delete butuh soft dulu + confirm |
| 3 | Edit password langsung? | **Tidak** → Reset email / Generate link |
| 4 | Retensi soft delete? | **30 hari** |
| 5 | Email di `user_profiles`? | Ya + sync dari Auth |

---

## Bagian 1 — Migration & fondasi

| Task | Deskripsi | Status |
|------|-----------|--------|
| 0.1 | Backup & cek data existing | ✅ (role/status bersih di prod) |
| 0.2 | Kolom `email` + backfill + trigger `handle_new_user` | ✅ |
| 0.2b | Trigger sync email Auth → profile | ✅ |
| 0.3 | Kolom soft delete & tracking (`deleted_at`, `delete_reason`, `email_original`, reset/logout timestamps, claim hard delete) | ✅ |
| 0.4 | Tabel `deleted_users_backup` + RLS admin read | ✅ |
| 0.5 | RPC `claim_for_hard_delete` | ✅ |
| 0.6 | RPC `update_user_profile_optimistic` | ✅ |
| 0.7 | View `v_user_details` (`security_invoker = true`) | ✅ |
| 0.8 | FK request `user_id` ON DELETE SET NULL (best effort) | ✅ |
| 0.9 | Tabel `admin_activity_log` + `admin_rate_limits` + RPC rate limit | ✅ |
| — | File rollback migration formal di repo | ⚠️ Tidak ada file SQL rollback terpisah (rollback = manual/Supabase history) |

---

## Bagian 2 — Detail User

| Task | Deskripsi | Status |
|------|-----------|--------|
| 1.1 | Route `/akun/users/:userId` | ✅ `src/pages/UserDetail.tsx` |
| 1.2 | Data dari `v_user_details` + request history | ✅ |
| 1.2b | Riwayat aksi admin (`admin_activity_log`) | ✅ |
| 1.3 | Loading / error / 404 + retry | ✅ |
| — | Audit row-level `user_profiles_audit` khusus (field-by-field) | ❌ Tidak dibuat; diganti activity log aksi admin |

---

## Bagian 3 — Edit User expand

| Task | Deskripsi | Status |
|------|-----------|--------|
| 2.1 | Field edit: nama, role, cabang, **phone** | ✅ List + Detail |
| 2.2 | Optimistic lock via RPC (`updated_at`) | ✅ Detail (RPC); list masih update langsung |
| 2.3 | Validasi nama min 3, role enum, email readonly | ✅ |

---

## Bagian 4 — Reset password & force logout

| Task | Deskripsi | Status |
|------|-----------|--------|
| 3.1 | Edge `reset_password` + audit activity | ✅ |
| 3.2 | Fallback **Generate Link** (`generate_reset_link`) + copy UI | ✅ |
| 3.3 | Force logout global + `force_logout_at` | ✅ |
| 3.4 | Notifikasi email ke user (role ubah / logout / hapus) | ❌ Tech debt |

**Edge function:** `admin-user-actions`  
**Client helper:** `src/lib/adminActions.ts`

---

## Bagian 5 — Hapus akun

| Task | Deskripsi | Status |
|------|-----------|--------|
| 4.1 | Soft delete (rename email Auth, force logout, alasan ≥10, tidak hapus diri, guard admin terakhir) | ✅ |
| 4.1 UI | Konfirmasi 3 langkah (yakin → ketik nama → alasan) | ✅ |
| 4.2 | Tab **Arsip** | ✅ |
| 4.3 | Restore dari arsip | ✅ |
| 4.4 | Hard delete (>30 hari, confirm nama+email, claim race, backup JSON, delete Auth) | ✅ |
| 4.5 | Guard hapus diri & admin terakhir | ✅ (server) |

---

## Bagian 6 — Polish

| Task | Deskripsi | Status |
|------|-----------|--------|
| 5.1 | Badge pending di sidebar | ✅ Poll 60s + realtime `account_requests` |
| 5.2 | Reviewer = `full_name` | ✅ |
| 5.3 | Filter Users: Semua / Aktif / Nonaktif + pagination 50 | ✅ |
| 5.4 | Mobile: overflow-x, form usable | ✅ Partial (sudah overflow + flex-wrap; bukan full redesign) |

---

## Bagian 7 — Edge Function security

| Task | Deskripsi | Status |
|------|-----------|--------|
| 7.1 | Validasi caller admin aktif | ✅ |
| 7.2 | Rate limit 10/menit/action | ✅ |
| 7.3 | CORS whitelist domain frontend | ❌ Masih `Access-Control-Allow-Origin: *` |
| 7.4 | Log setiap panggilan → `admin_activity_log` | ✅ |
| 7.5 | Service role hanya di Edge (bukan client) | ✅ |

**Actions tersedia:**

- `reset_password`
- `generate_reset_link`
- `force_logout`
- `soft_delete`
- `restore`
- `hard_delete`

---

## Bagian 8–9 — Deploy & testing

| Task | Status |
|------|--------|
| Deploy ke `main` + Pages | ✅ Kode di main |
| Checklist E2E formal staging | ⚠️ Manual — pakai daftar di bawah |
| Beta roll-out hapus 1 admin 1 minggu | ❌ Proses operasional, belum dijadwalkan |
| Rollback plan documented | ⚠️ Ringkas di sini saja |

### Checklist test manual (DoD)

- [ ] Signup → pending → approve → login
- [ ] Detail user: email, UUID copy, login terakhir
- [ ] Edit concurrent (2 tab) → tab kedua error optimistic lock
- [ ] Reset password email masuk (jika SMTP Supabase ON)
- [ ] Generate link → copy → buka → set password
- [ ] Force logout → session device lain mati
- [ ] Soft delete 3 step → user di Arsip, login ditolak
- [ ] Restore → login lagi
- [ ] Hard delete < 30 hari ditolak; ≥ 30 hari + confirm → backup + Auth hilang
- [ ] Badge pending muncul di sidebar saat ada request baru
- [ ] Filter Aktif/Nonaktif + pagination
- [ ] Viewer/operator tidak bisa buka `/akun`
- [ ] Tanpa JWT / role non-admin → Edge 401/403

---

## Tech debt (jangan kerjakan di v2.1 kecuali lead buka)

Dari planning + backlog:

1. Notifikasi email user (role change, force logout, soft delete)
2. CORS Edge hanya domain app (bukan `*`)
3. Optimistic lock juga di modal edit list Users
4. Tabel `user_profiles_audit` field-level (opsional)
5. Pagination Arsip + filter tanggal hapus
6. Bulk nonaktif / bulk soft delete
7. Export user data (GDPR)
8. Login history UI per user
9. 2FA admin
10. Auto-cleanup backup > 1 tahun
11. File migration rollback SQL di `supabase/migrations/`

Ide baru → tulis di `BACKLOG_v3.3.md` atau issue baru, **jangan** revisi v2.1 locked scope tanpa lead.

---

## File / artefak terkait

| Path | Keterangan |
|------|------------|
| `src/pages/AccountManagement.tsx` | Requests / Users / Arsip |
| `src/pages/UserDetail.tsx` | Detail + aksi sensitif |
| `src/lib/adminActions.ts` | Client → Edge |
| `src/lib/authProfile.ts` | Tipe profile + fetch gate |
| `src/components/Layout.tsx` | Badge pending |
| `src/App.tsx` | Route `/akun`, `/akun/users/:userId` |
| Edge: `admin-user-actions` | Semua aksi admin sensitif |
| DB: `user_profiles`, `account_requests`, `deleted_users_backup`, `admin_activity_log`, `v_user_details` | |

---

## Cara baca status untuk daily

1. **Selesai** = sudah di `main` + bisa diuji di app.
2. **Belum** = masih terbuka; prioritaskan hanya jika lead angkat dari tech debt.
3. Bug production → fix langsung, catat di sini (tambah baris “Bug fix log”), jangan bikin planning baru.

### Bug fix log

| Tanggal | Item | Catatan |
|---------|------|---------|
| 2026-10-15 | Restore `AccountManagement.tsx` | Sempat ter-push placeholder; sudah diganti konten penuh |

---

**Owner eksekusi:** Tim SDLG Monitor  
**Dokumen ini:** living status untuk planning v2.1, bukan PRD produk penuh (lihat `docs/PRD.md`).
