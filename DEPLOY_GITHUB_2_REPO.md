# Deploy GitHub 2 Repo

Pola yang dipakai:

- Repo 1: `T51T-source` -> private -> untuk source code
- Repo 2: `T51T` -> public -> untuk website GitHub Pages

Target website:

- `https://tulus45.github.io/T51T`

## 1. Buat 2 repo di GitHub

Buat dua repository berikut di akun GitHub `tulus45`:

1. `T51T-source`
- visibility: `Private`
- isi: kosong dulu, jangan centang README / .gitignore / license

2. `T51T`
- visibility: `Public`
- isi: kosong dulu, jangan centang README / .gitignore / license

## 2. Simpan source project ke repo private

Jalankan dari folder project ini:

```powershell
git init
git config --global user.name "Nama Anda"
git config --global user.email "email-anda@example.com"
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/tulus45/T51T-source.git
git push -u origin main
```

Kalau repo local ini nanti sudah ada commit baru, cukup update source dengan:

```powershell
git add .
git commit -m "Update project"
git push origin main
```

## 3. Atur GitHub Pages di repo public `T51T`

Buka repo `T51T` di browser, lalu:

1. `Settings`
2. `Pages`
3. `Build and deployment`
4. `Source` pilih `Deploy from a branch`
5. `Branch` pilih `gh-pages`
6. Folder pilih `/ (root)`
7. `Save`

## 4. Deploy website ke repo public

Project ini sudah disiapkan script deploy ke repo public `T51T`.

Jalankan:

```powershell
npm install
npm run deploy:web
```

Perintah itu akan:

- build project ke folder `dist`
- push isi `dist` ke repo public `https://github.com/tulus45/T51T.git`

## 5. Buka website

Setelah deploy selesai, tunggu sekitar 1-5 menit lalu buka:

- `https://tulus45.github.io/T51T`

## Catatan Penting

- Source code utama tetap aman di repo private `T51T-source`.
- Repo public `T51T` hanya dipakai untuk website hasil build.
- Kalau Anda ubah source code, lakukan dua langkah ini:

```powershell
git add .
git commit -m "Pesan perubahan"
git push origin main
npm run deploy:web
```

## Kalau `npm run deploy:web` minta login

Biasanya GitHub akan meminta autentikasi. Anda bisa login dengan:

- browser sign-in
- Git Credential Manager
- atau Personal Access Token

## SQL Supabase

Perubahan SQL di folder `supabase/` tidak otomatis ikut ke Supabase hanya karena di-push ke GitHub.
File SQL tetap harus dijalankan manual di project Supabase Anda.
