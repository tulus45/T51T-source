# Store Staff Manager

Aplikasi web manajemen toko berbasis React + Vite + Tailwind + Supabase dengan arsitektur modular, RBAC, route protection, UI restriction, dan function-level guard.

## Tech Stack

- Frontend: React + Vite
- Styling: Tailwind CSS
- Routing: React Router DOM (`HashRouter` agar aman untuk GitHub Pages)
- Backend: Supabase Auth, Database, Storage
- State: Context API
- UI: Sidebar layout, topbar, modal form, confirm dialog, toast notification

## Struktur Folder

```text
src/
  components/
    cash/
      CashReportFormModal.jsx
    employees/
      EmployeeCard.jsx
      EmployeeFormModal.jsx
    schedules/
      ScheduleFormModal.jsx
    ui/
      Badge.jsx
      Button.jsx
      ConfirmDialog.jsx
      EmptyState.jsx
      Input.jsx
      Modal.jsx
      Select.jsx
      Spinner.jsx
      StatCard.jsx
      Textarea.jsx
      ToastViewport.jsx
    PageHeader.jsx
    Sidebar.jsx
    Topbar.jsx
  context/
    AuthContext.jsx
    ToastContext.jsx
  hooks/
    useAuth.js
    usePermissions.js
    useToast.js
  layouts/
    AppLayout.jsx
    AuthLayout.jsx
  lib/
    supabaseClient.js
  pages/
    CashReportsPage.jsx
    DashboardPage.jsx
    EmployeesPage.jsx
    LoginPage.jsx
    NotFoundPage.jsx
    SchedulesPage.jsx
    UnauthorizedPage.jsx
    UsersPage.jsx
  routes/
    AppRoutes.jsx
    ProtectedRoute.jsx
    routeConfig.js
  services/
    authService.js
    baseService.js
    cashReportsService.js
    dashboardService.js
    employeesService.js
    schedulesService.js
    usersService.js
  utils/
    constants.js
    formatters.js
    helpers.js
    permissions.js
    schedule.js
  App.jsx
  index.css
  main.jsx
supabase/
  bootstrap.sql
  schema.sql
  seed.sql
```

## File Utama

- `src/main.jsx`: bootstrap React, Router, AuthProvider, ToastProvider.
- `src/App.jsx`: root aplikasi.
- `src/routes/AppRoutes.jsx`: konfigurasi route utama.
- `src/routes/ProtectedRoute.jsx`: route guard berbasis auth dan role.
- `src/context/AuthContext.jsx`: auth flow login, logout, session hydration, ambil profile.
- `src/lib/supabaseClient.js`: setup client Supabase menggunakan env.
- `src/pages/EmployeesPage.jsx`: contoh halaman lengkap CRUD pegawai + upload foto + filter + RBAC.
- `supabase/schema.sql`: schema tabel, trigger profiles, bucket storage, dan RLS.
- `supabase/bootstrap.sql`: helper promote `super_admin` pertama.
- `supabase/seed.sql`: data demo pegawai, kas, dan jadwal.

## Fitur yang Sudah Dibuat

- Login dengan email dan password Supabase.
- Session persistence.
- Ambil `profile` + `role` dari tabel `profiles`.
- Dashboard summary.
- Struktur pegawai dengan card/grid, filter jabatan, upload foto Storage, CRUD.
- Laporan kas dengan filter, summary, format rupiah, CRUD.
- Jadwal shift dengan validasi 1 pegawai 1 shift per hari, CRUD, dan generate round-robin.
- Manajemen user khusus `super_admin`.
- Route protection, UI restriction, dan function-level guard.

## Environment Variables

Buat file `.env` dari `.env.example`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Setup Supabase

1. Buat project baru di Supabase.
2. Buka `SQL Editor`.
3. Jalankan isi file `supabase/schema.sql`.
4. Buka `Authentication > Users`, lalu buat user pertama atau sign up lewat aplikasi.
5. Login sekali menggunakan user itu agar baris `profiles` otomatis terbentuk.
6. Jalankan `supabase/bootstrap.sql`.
7. Pada query promote, ganti `owner@toko.com` dengan email user pertama Anda, lalu jalankan.
8. Verifikasi bahwa role user tersebut sudah menjadi `super_admin`.
9. Jika ingin data demo, jalankan `supabase/seed.sql`.

## Bootstrap Super Admin Pertama

Jika Anda ingin jalankan manual tanpa file helper, query intinya seperti ini:

```sql
update public.profiles p
set role = 'super_admin',
    is_active = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('owner@toko.com');
```

Ganti `owner@toko.com` dengan email akun Anda.

## Step-by-Step Setup di VS Code

1. Install Node.js versi 18 atau lebih baru.
2. Buka folder project ini di VS Code.
3. Buka terminal VS Code lalu jalankan:

```bash
npm install
```

4. Copy `.env.example` menjadi `.env`, lalu isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
5. Pastikan `supabase/schema.sql` sudah dijalankan di project Supabase Anda.
6. Buat user pertama di Supabase Auth.
7. Jalankan `supabase/bootstrap.sql` untuk promote user pertama menjadi `super_admin`.
8. Opsional: jalankan `supabase/seed.sql` untuk mengisi data demo.
9. Jalankan development server:

```bash
npm run dev
```

10. Buka URL yang muncul di terminal, biasanya `http://localhost:5173`.
11. Login menggunakan akun Supabase yang sudah dipromote menjadi `super_admin`.

## Build Production

```bash
npm run build
npm run preview
```

## Deploy ke GitHub Pages

Karena aplikasi ini memakai `HashRouter` dan `base: './'`, deploy ke GitHub Pages jadi lebih sederhana.

1. Buat repository GitHub baru.
2. Push project ini ke branch `main`.
3. Pastikan `.env` lokal Anda sudah terisi karena nilai `VITE_` akan di-embed saat build.
4. Jalankan build dan publish:

```bash
npm run deploy
```

5. Package `gh-pages` akan membuat branch `gh-pages` otomatis.
6. Di GitHub, buka `Settings > Pages`.
7. Pada `Build and deployment`, pilih source `Deploy from a branch`.
8. Pilih branch `gh-pages` dan folder `/ (root)`.
9. Simpan lalu tunggu URL GitHub Pages aktif.

## Catatan Seed Data

- `supabase/seed.sql` aman dijalankan berulang karena memakai pengecekan duplikasi sederhana.
- Data jadwal demo dibuat untuk `current_date + 1`.
- Seed akan mencari `super_admin` atau `admin` pertama sebagai `created_by`. Jika belum ada, data tetap bisa masuk dengan `created_by = null`.

## Catatan RBAC

- `super_admin`: full access semua fitur, termasuk manajemen user.
- `admin`: CRUD pegawai, kas, dan jadwal. Tidak punya halaman manajemen user.
- `viewer`: read-only.
- Enforcement dilakukan di tiga level:
  - route level: `ProtectedRoute`
  - UI level: tombol aksi disembunyikan sesuai role
  - function level: `assertPermission()` sebelum mutasi data
- Enforcement final tetap dijaga oleh Supabase RLS di `supabase/schema.sql`.
