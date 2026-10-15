# BACKLOG v3.3 — setelah P0.5 rilis

Ide baru / residual. Jangan revisi planning v3.2.

## P1 — Auto-invite setelah Approve

- Edge Function `invite-user` pakai service role
- Input: email, nama, role, cabang
- Supabase Auth inviteUserByEmail + metadata
- Trigger `handle_new_user` sudah siap di DB
- UI Account Management: tombol Approve langsung invite (hilangkan langkah manual)

## P1 — UnitDetailDrawer role + audit (partial di main)

Helper sudah ada:
- `src/lib/unitEdit.ts`
- `src/lib/auditLog.ts`
- `src/lib/AuthProfileContext.tsx`

Masih perlu wire di `UnitDetailDrawer.tsx`:
1. Import `useAuthProfileOptional`, `canEdit`, `isAdmin`, `saveUnitEdits`, `writeFieldAudits`
2. `allowEdit` / `adminUser` dari profile
3. `handleSaveFullUnit` → panggil `saveUnitEdits`
4. Sembunyikan tombol Edit jika `!allowEdit`
5. VIN / unit_number readOnly untuk non-admin
6. `handleToggleProcess` gate + audit

File patch siap di artifact lokal / minta lead push file penuh.

## P1 — Disable public signup

Manual: Supabase Dashboard → Authentication → Providers → Email → Disable sign ups.

## P2

- Export CSV role-aware
- Badge pending count di nav Layout
- Soft-delete unit (status scrapped) via UI admin
- Rate limit account_requests

## Jangan kerjakan di P0.5

- SSO / OAuth
- Password di form publik
- Multi-step approval
