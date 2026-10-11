# Deploy pembaruan RepLog

Gunakan repository `abyazSH/RepLog`, branch `main`, dan project Vercel yang sudah ada. Tidak perlu membuat project baru.

## Pemeriksaan kode

Dari folder project, jalankan:

```powershell
npm ci
npm run verify
```

`verify` menjalankan pengujian dan build produksi. File `.env.local`, `.next`, `node_modules`, dan `.vercel` diabaikan Git. Jangan upload folder project secara mentah ke repository.

## Konfigurasi Vercel

- Framework: Next.js.
- Root Directory: folder yang berisi `package.json` (root repository saat ini).
- Build Command: `npm run build`.
- Output Directory: default Next.js.
- Pastikan Production Branch adalah `main`.
- Pertahankan environment variables Production berikut:
  - `NEXT_PUBLIC_SUPABASE_URL`: URL project Supabase yang digunakan.
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable key project tersebut.
  - `APP_URL`: `https://rep-log-gamma.vercel.app` bila domain produksi tersebut masih digunakan.

Jangan gunakan key `service_role`. Setelah mengubah environment variables, buat deployment baru agar bundle menggunakan nilainya.

## Supabase

Pastikan Authentication > URL Configuration menggunakan domain produksi yang sama:

- Site URL: `https://rep-log-gamma.vercel.app`
- Redirect URL: `https://rep-log-gamma.vercel.app/auth/callback`

Sebelum deploy pembaruan pengelolaan program, jalankan isi `supabase/migrations/003_custom_programs.sql` di Supabase SQL Editor. Migrasi ini dapat dijalankan ulang dan memungkinkan daftar program kosong. Data lama, RLS, pemeriksaan akun, dan perlindungan konflik penyimpanan tetap dipertahankan.

## Kirim pembaruan melalui CLI

```powershell
git status
git add app components lib tests supabase package.json README.md DEPLOYMENT.md
git commit -m "Add profile language preferences and workout share cards"
git push origin main
```

Di Vercel > Deployments, pastikan deployment commit terbaru berstatus Ready. Kemudian uji login, pengaturan bahasa di Profil, menyelesaikan set dan timer di Latihan, serta unduh kartu dari Riwayat. Pengujian otomatis tidak menggantikan uji login akun asli atau menu berbagi perangkat.

Pengaturan cloud di atas perlu diperiksa pada project Vercel/Supabase; build lokal tidak memverifikasi nilai environment variables cloud.

Pembaruan kardio memakai struktur JSON pada tabel workout_state yang sudah ada. Tidak perlu SQL tambahan setelah 003 diterapkan. Uji program campuran serta sesi khusus kardio: tambah lewat Profil, isi durasi/speed/incline treadmill atau durasi sepeda, tandai selesai, lalu periksa Riwayat, Progress, dan kartu berbagi.
