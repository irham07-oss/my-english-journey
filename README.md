# My English Journey

Dashboard progres belajar bahasa Inggris. Frontend statis (HTML + CSS + ES modules), data disimpan di **Supabase** (Postgres + Auth). Satu akun, tanpa registrasi publik.

## Struktur file

| File | Isi |
|---|---|
| `index.html` | Shell aplikasi, login, boot/error state |
| `style.css` | Seluruh CSS |
| `app.js` | Logika UI, render, event, migrasi |
| `data.js` | Lapisan data Supabase (auth + CRUD) |
| `utils.js` | Helper murni (tanggal lokal, streak, mapping key) |
| `content.js` | Data statis tahap/materi/jadwal |
| `supabase-config.js` | URL + anon key project Supabase |
| `schema.sql` | Tabel, RLS, index, fungsi migrasi |
| `tests/utils.test.mjs` | Tes helper (`node tests/utils.test.mjs`) |
| `legacy-export.js` | Penawaran unduh data lama di URL lama |
| `my_english_journey.html` | Redirect ke `index.html` (link lama tetap jalan) |
| `backup/` | File asli sebelum refactor |

## 1. Setup Supabase

1. Buat project di [supabase.com](https://supabase.com) (region Singapore cukup).
2. Buka **SQL Editor** → **New query** → tempel seluruh isi `schema.sql` → **Run**.
   Harus muncul `Success. No rows returned`.
3. Buka **Authentication → Providers → Email**:
   - Enable Email provider.
   - Setelah akun dibuat, matikan **Allow new users to sign up**.
4. Buka **Authentication → Users → Add user**:
   - Email + password Julian.
   - Aktifkan **Auto Confirm User** agar bisa langsung login.
5. Buka **Settings → API**, salin:
   - **Project URL**
   - **anon public** key

   Isi `supabase-config.js`:

   ```js
   export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
   ```

6. Buka **Authentication → URL Configuration**:
   - **Site URL**: `http://127.0.0.1:8000` (lokal) atau URL deploy.
   - **Redirect URLs**: tambahkan `http://127.0.0.1:8000/**` dan URL GitHub Pages/Vercel.
   - Login email/password tidak memakai link redirect, tetapi ini tetap disarankan.

> **Jangan** memakai `service_role` key di frontend. Anon key memang publik dan dilindungi RLS.

## 2. Menjalankan lokal

ES modules tidak bisa dibuka lewat `file://`, jadi pakai server lokal:

```bash
cd D:\julian
php -S 127.0.0.1:8000
```

Buka `http://127.0.0.1:8000/`.

Alternatif tanpa PHP:

```bash
npx serve .
# atau
python -m http.server 8000
```

Tes helper:

```bash
node tests/utils.test.mjs
```

## 3. Deploy GitHub Pages

1. Buat repository baru di GitHub (public).
2. Dari folder project:

   ```bash
   git remote add origin https://github.com/USERNAME/REPO.git
   git branch -M main
   git push -u origin main
   ```

   Sebelum push, pastikan identitas commit benar:

   ```bash
   git config user.name "Nama Kamu"
   git config user.email "email@github"
   ```

3. Di repository: **Settings → Pages → Build and deployment**
   - Source: **Deploy from a branch**
   - Branch: `main`, folder `/ (root)` → **Save**
4. Tunggu deploy. URL: `https://USERNAME.github.io/REPO/`
5. Update **Supabase → Authentication → URL Configuration → Site URL** ke URL tersebut.

Link lama `my_english_journey.html` otomatis redirect ke `index.html`.

## 4. Deploy Vercel

Cara web:

1. Buka [vercel.com/new](https://vercel.com/new), import repository GitHub.
2. Framework Preset: **Other**.
3. Build Command: kosongkan. Output Directory: kosongkan/root (`.`).
4. **Deploy**.

Atau via CLI:

```bash
npm i -g vercel
vercel
vercel --prod
```

Setelah dapat URL Vercel, update **Supabase → Authentication → URL Configuration → Site URL**.

Boleh pakai GitHub Pages dan Vercel sekaligus; tambahkan kedua URL ke Redirect URLs.

## 5. Migrasi data lama

Data lama tersimpan di `localStorage` browser dengan key `englishJourneyState`.

- Jika aplikasi baru dibuka di **origin yang sama** dengan versi lama (misalnya sama-sama `http://127.0.0.1:8000`), login pertama akan otomatis memindahkan data ke Supabase.
- Jika origin berbeda (misalnya versi lama dibuka via `file://`, versi baru di GitHub Pages), buka `my_english_journey.html` di browser yang sama. Halaman itu akan menawarkan **Unduh data lama** sebelum redirect.
- Setelah dapat file JSON, login ke aplikasi baru → halaman **Progress** → **Impor data lama** → pilih file tersebut.
- Impor hanya jalan jika database Supabase masih kosong. Jika sudah ada data, impor akan dilewati untuk menghindari duplikasi.
- Tombol **Ekspor progress** mengunduh seluruh data dari Supabase sebagai JSON.
- Key lama diubah menjadi `englishJourneyState_backup` setelah migrasi otomatis; data lama tidak dihapus paksa.

## 6. Keamanan

- RLS aktif di semua tabel: user hanya bisa membaca/menulis baris dengan `user_id = auth.uid()`.
- Sign-up publik dimatikan; akun dibuat manual.
- `supabase-config.js` aman di-commit karena hanya berisi URL + anon key.
- Jangan pernah menaruh `service_role` key di repo/frontend.
- `schema.sql`, `README.md`, dan `backup/` juga ikut ter-publish di hosting statis; isinya bukan rahasia.

## 7. Troubleshooting

| Gejala | Penyebab / solusi |
|---|---|
| Layar "Supabase belum dikonfigurasi" | Isi URL + anon key di `supabase-config.js`, lalu reload. |
| `relation ... does not exist` | `schema.sql` belum dijalankan di project yang benar. |
| `permission denied for sequence` | Jalankan ulang bagian sequence grants di `schema.sql` versi terbaru. |
| `Invalid login credentials` | User belum dibuat, password salah, atau email belum dikonfirmasi. |
| Login sukses tetapi data kosong | Cek RLS + `user_id`; jalankan ulang schema; pastikan login sebagai user yang sama. |
| Layar boot berhenti di "Memuat…" | CDN Supabase/jsDelivr diblokir atau offline. Coba jaringan lain, cek Console browser. |
| Catatan tidak tersimpan | Sesi login habis; login ulang lalu simpan lagi. |
| GitHub Pages 404 | Pastikan source Pages = branch `main`, folder `/ (root)`. Nama file case-sensitive. |
| Project Supabase tidur | Free tier bisa pause karena inactivity; buka dashboard → Restore. Data tetap ada. |
| Streak/tanggal terlihat bergeser | App memakai tanggal lokal perangkat; pastikan timezone perangkat benar. |

## 8. Checklist uji manual

- [ ] Login, refresh halaman, sesi tetap aktif.
- [ ] Checklist tahap dicentang → reload → tetap tersimpan.
- [ ] Klik materi → konfirmasi → checklist + hari belajar + riwayat bertambah.
- [ ] **Tandai belajar hari ini** → streak bertambah.
- [ ] Checklist mingguan dan harian tersimpan setelah reload.
- [ ] Tambah/hapus kata di Kamus Pribadi.
- [ ] Simpan catatan → reload → catatan tetap ada.
- [ ] Kerjakan tes → hasil muncul dan tetap ada setelah reload.
- [ ] Ekspor progress menghasilkan file JSON.
- [ ] Logout → kembali ke halaman login.
