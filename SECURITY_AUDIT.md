## Audit Ringkas

### Status Saat Ini

Yang sudah dipindah dari client ke server/database:

- Ringkasan dashboard sudah memakai RPC `public.get_dashboard_summary()`.
- Write target sales bulanan sudah memakai RPC `public.upsert_sales_month_target()`.
- Write sales harian sudah memakai RPC `public.upsert_sales_daily_report()`.
- `cash_reports` sekarang sudah memakai RPC `public.list_cash_reports()`, `public.create_cash_report()`, `public.update_cash_report()`, dan `public.delete_cash_report()`.
- `viewer` bisa melihat `Laporan Kas` dalam mode read-only melalui RPC, sementara create/update/delete tetap hanya untuk `admin` dan `super_admin`.
- Build production sudah di-hardening di `vite.config.js`.

Artinya, dashboard, write sales, dan modul kas sudah lebih aman dibanding sebelumnya. Masih ada beberapa modul yang tetap membuka query, nama tabel, dan pola CRUD langsung dari browser.

### Yang Sudah Baik

- Front-end memakai `anon key`, bukan `service_role`.
- RLS aktif untuk tabel utama.
- Policy write mayoritas sudah dibatasi ke `admin` dan `super_admin`.
- UI role-based sudah cukup rapi untuk membatasi tombol dan form.
- Modul kas sekarang sudah memakai pola yang lebih tepat: viewer read-only lewat RPC, write tetap dibatasi.

### Catatan Penting

Pembatasan UI tidak sama dengan pembatasan data.

Kalau browser masih memanggil `supabase.from('nama_tabel')` langsung, maka orang yang login tetap bisa melihat nama tabel, pola query, payload, dan mencoba membaca data sesuai policy RLS yang berlaku.

## Area Yang Masih Terbuka Di Client

### Risiko Tinggi

1. `src/services/schedulesService.js`
- Read, insert, update, upsert, bulk create, dan delete jadwal masih langsung dari client ke tabel `schedules`.
- Viewer memang dibatasi di UI agar hanya melihat minggu berjalan, tetapi policy database saat ini masih membolehkan select untuk semua profile aktif.
- Dampaknya: viewer yang paham devtools tetap bisa meminta jadwal tanggal lain langsung ke API selama policy tidak dipersempit.

2. `src/services/employeesService.js`
- Query pegawai masih `select('*')` langsung ke tabel `employees`.
- Rule pisah shift juga dibaca langsung dari `employee_shift_separation_rules`.
- Kolom sensitif untuk viewer hanya disembunyikan di UI, tetapi datanya tetap ikut terkirim ke browser.
- Dampaknya: field seperti shift, off day, holiday mandatory off, status, dan relasi pisah shift tetap bisa terlihat lewat response API.

3. `src/services/salesReportsService.js`
- Write sales sudah aman melalui RPC, tetapi read target bulanan dan read sales harian masih langsung dari `sales_monthly_targets` dan `sales_daily_reports`.
- Policy baca dua tabel itu juga masih terbuka untuk semua profile aktif.
- Dampaknya: data sales masih bisa diambil langsung dari browser selama user punya session aktif.

### Risiko Menengah

4. `src/services/usersService.js`
- `profiles` masih dibaca dan diupdate langsung dari client.
- Untungnya policy `profiles` jauh lebih ketat: read hanya untuk diri sendiri atau `super_admin`, update hanya oleh `super_admin`.
- Jadi dari sisi exposure data, risikonya lebih rendah. Dari sisi kerahasiaan struktur tabel dan payload, tetap terbuka.

5. `src/services/authService.js`
- `getProfileByUserId()` masih query langsung ke `profiles`.
- Karena dibatasi RLS self/super admin, ini bukan temuan kritis, tetapi tetap berarti nama tabel dan pola akses profile ada di bundle client.

### Risiko Storage

6. Bucket foto pegawai masih public
- `employee-photos` di `supabase/schema.sql` masih `public = true`.
- `uploadEmployeePhoto()` di `src/services/employeesService.js` memakai `getPublicUrl()`.
- Dampaknya: kalau URL diketahui, foto bisa diakses tanpa login.

## Prioritas Penutupan

### Prioritas 1: Jadwal

- Buat RPC untuk list minggu aktif viewer.
- Buat RPC untuk save, generate, dan reset jadwal.
- Setelah itu, persempit select mentah tabel `schedules`.

### Prioritas 2: Pegawai

- Buat RPC/view khusus viewer dengan kolom terbatas.
- Pindahkan create/update/delete pegawai ke RPC.
- Pindahkan replace separation rules ke RPC.

### Prioritas 3: Read Sales

- Evaluasi apakah viewer memang perlu melihat semua data sales mentah.
- Kalau tidak, batasi select atau arahkan pembacaan lewat RPC summary saja.

### Prioritas 4: Foto Pegawai

- Ubah bucket `employee-photos` menjadi private.
- Ganti `getPublicUrl()` dengan signed URL atau endpoint server-side.

## Rekomendasi Kerja Nyata Berikutnya

Kalau ingin menutup risiko paling penting satu per satu, urutan kerja yang saya sarankan sekarang adalah:

1. Pindahkan read jadwal viewer ke RPC minggu berjalan.
2. Pindahkan CRUD jadwal ke RPC.
3. Pindahkan read pegawai viewer ke RPC dengan kolom terbatas.
4. Pindahkan CRUD pegawai ke RPC.
5. Ubah bucket foto pegawai menjadi private.

## Kesimpulan

Aplikasi ini sekarang sudah lebih aman daripada sebelumnya, dan modul kas sudah masuk pola yang lebih sehat: viewer bisa lihat read-only, sedangkan write tetap dibatasi.

Titik lemah berikutnya yang paling penting sekarang adalah:
- jadwal
- pegawai
- read sales
- bucket foto public

Selama area-area itu masih query langsung dari client, user yang cukup teknis masih bisa membaca struktur data dan mencoba mengambil data sesuai policy yang tersedia.
