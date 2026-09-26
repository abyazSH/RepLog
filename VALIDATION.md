# Validasi timer dan sesi sebelumnya - 26 September 2026
- `npm test`: 16 pengujian lulus, termasuk pemilihan sesi acuan per program dan perhitungan sisa waktu berdasarkan waktu nyata.
- `npm run build`: berhasil termasuk TypeScript.
- Timer memakai deadline, bukan jumlah tick. Preferensi durasi tersimpan lokal; timer aktif tersimpan di tab yang sama.
- Sesi acuan mengecualikan sesi aktif dan sesi yang lebih baru, serta menggunakan program dan variasi gerakan yang cocok.
- Interaksi timer belum diuji secara visual melalui browser.

## Validasi route dan landing page - 25 September 2026
- Halaman publik `/` berisi perkenalan RepLog; halaman akun memakai `/dashboard`, `/workouts`, `/progress`, `/history`, `/profile` dengan layout bersama.
- Login dan register terpisah; tujuan sukses dan callback adalah `/dashboard`.
- `npm test`: 14 pengujian lulus. `npm run build`: berhasil termasuk TypeScript dan seluruh route baru.
- Smoke test produksi lokal: delapan route utama HTTP 200, konten landing publik dan pemisahan form login/register diperiksa. Server pengujian sudah dihentikan.
- Pengujian visual/browser dan alur akun nyata belum dilakukan pada perubahan ini karena alat browser gagal inisialisasi.

## Validasi sebelumnya: email/password
- npm test: 13 pengujian lulus.
- npm run build: berhasil, termasuk TypeScript.
- Migrasi 001 + 002 dieksekusi di PGlite dengan simulasi schema Auth; 002 dijalankan ulang untuk memeriksa kompatibilitas rerun.
- Akun email terkonfirmasi tanpa undangan dapat menyimpan data.
- RLS membatasi pembacaan ke pemilik; revisi lama ditolak.
- Akun tanpa konfirmasi email, Google-only, dan anonymous ditolak.
- Logout Supabase yang sudah ada tetap digunakan.
- Login, register dan callback cloud belum diuji end-to-end: perlu konfigurasi environment, migrasi 002, Email provider dan pengiriman email di Supabase.
- Migrasi cloud belum diterapkan oleh agen. Data demo tidak diubah.
