# P0.5 Test Checklist (v3.2)

## Form ajukan akun

- [ ] Field `*` wajib terlihat
- [ ] Nama < 3 karakter → error
- [ ] Alasan < 10 karakter → error
- [ ] Cabang LAINNYA tanpa teks → error
- [ ] Cabang LAINNYA + teks → success
- [ ] Email pending duplikat → error
- [ ] Success message sebutkan password via invite

## Account Management — Requests

- [ ] Default filter = pending
- [ ] Filter approved / rejected / semua
- [ ] Search nama/email
- [ ] UUID request tampil
- [ ] Approve → status + pesan invite steps
- [ ] Reject → confirm dialog
- [ ] Reject alasan < 10 → error
- [ ] Reject valid → alasan tersimpan + reviewer info

## Account Management — Users

- [ ] List user + UUID
- [ ] Edit nama / role / cabang
- [ ] Nonaktifkan → user tidak bisa masuk app
- [ ] Aktifkan kembali

## Auth flow

- [ ] Login admin OK
- [ ] User nonaktif → gate "akun belum diaktifkan"
- [ ] Signup publik dimatikan di dashboard (manual)

## Mobile 375px

- [ ] Form usable
- [ ] Tabel scroll / readable
- [ ] Tombol aksi klikable
