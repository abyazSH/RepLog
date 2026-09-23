# Validasi email/password - 23 September 2026
- npm test: 13 pengujian lulus.
- npm run build: berhasil, termasuk TypeScript.
- Migrasi 001 + 002 dieksekusi di PGlite dengan simulasi schema Auth; 002 dijalankan ulang untuk memeriksa kompatibilitas rerun.
- Akun email terkonfirmasi tanpa undangan dapat menyimpan data.
- RLS membatasi pembacaan ke pemilik; revisi lama ditolak.
- Akun tanpa konfirmasi email, Google-only, dan anonymous ditolak.
- Logout Supabase yang sudah ada tetap digunakan.
- Login, register dan callback cloud belum diuji end-to-end: perlu konfigurasi environment, migrasi 002, Email provider dan pengiriman email di Supabase.
- Migrasi cloud belum diterapkan oleh agen. Data demo tidak diubah.
