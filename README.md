# Store Staff Manager

Aplikasi web manajemen toko berbasis React + Vite di frontend, dengan backend lokal Node.js + Express + SQLite.

## Arsitektur

- Frontend: React + Vite
- Backend: Node.js + Express
- Database lokal: SQLite (`server/database.sqlite`)
- Auth: session token sederhana via `localStorage` dan `sessionStorage`
- API frontend: semua request lewat path relatif `/api`
- Deploy produksi: frontend dari `dist`, lalu reverse proxy `/api` ke backend

## Struktur Folder

```text
src/
  components/
  context/
  hooks/
  layouts/
  lib/
    supabaseClient.js   # sekarang berisi fetch API client + auth storage helper
  pages/
  routes/
  services/
  utils/
  App.jsx
  main.jsx
server/
  db.js
  server.js
  package.json
  database.sqlite      # otomatis dibuat saat backend pertama kali jalan
```

## Login Default

Backend akan men-seed akun admin lokal otomatis jika database belum ada.

- Email: `admin@t51t.local`
- Password: `admin123`
- Role: `super_admin`

## Menjalankan Backend

```bash
cd server
npm install
npm start
```

Backend membaca `PORT` dari environment, dengan default `4718`.

Contoh:

```bash
PORT=4718 npm start
```

Jika Anda menjalankannya dari PowerShell Windows, gunakan bentuk ini:

```powershell
$env:PORT=4718
npm.cmd start
```

## Menjalankan Frontend

Dari root project:

```bash
npm install
npm run dev
```

Frontend tetap memakai path relatif `/api`. Saat development, Vite akan mem-proxy `/api` ke backend lokal. Target default-nya adalah `http://127.0.0.1:4718` dan bisa diubah lewat `.env`:

```env
VITE_API_PROXY_TARGET=http://127.0.0.1:4718
```

## Build Frontend

```bash
npm run build
npm run preview
```

## API yang Dipakai Frontend

- Auth
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/session`
- Dashboard
  - `GET /api/dashboard/summary`
- Employees
  - `GET /api/employees`
  - `POST /api/employees`
  - `PUT /api/employees/:id`
  - `PUT /api/employees/:id/separation-rules`
  - `DELETE /api/employees/:id`
  - `POST /api/employees/photo`
- Schedules
  - `GET /api/schedules`
  - `POST /api/schedules`
  - `PUT /api/schedules/:id`
  - `POST /api/schedules/upsert`
  - `POST /api/schedules/bulk`
  - `POST /api/schedules/prune`
  - `POST /api/schedules/delete-by-ids`
  - `DELETE /api/schedules/:id`
  - `DELETE /api/schedules`
- Cash Reports
  - `GET /api/cash-reports`
  - `POST /api/cash-reports`
  - `PUT /api/cash-reports/:id`
  - `DELETE /api/cash-reports/:id`
- Sales Reports
  - `GET /api/sales/month-target`
  - `PUT /api/sales/month-target`
  - `GET /api/sales/daily`
  - `PUT /api/sales/daily`
  - `DELETE /api/sales/daily/:date`
- User Management
  - `GET /api/users`
  - `PATCH /api/users/:id`

## Catatan Produksi

Konfigurasi yang diharapkan:

- Nginx serve frontend dari folder `dist`
- Nginx proxy semua request `/api` ke backend Express
- Upload foto pegawai disajikan oleh backend lewat `/api/uploads/...`

## Catatan Migrasi

- Dependency runtime Supabase di frontend sudah dihapus.
- File `src/lib/supabaseClient.js` dipertahankan namanya agar import lama tetap stabil, tetapi isinya sekarang adalah API client berbasis `fetch`.
- Folder `supabase/` lama masih bisa disimpan sebagai referensi historis, tetapi tidak lagi dipakai oleh runtime aplikasi.