-- Store Staff Manager bootstrap helper
-- Jalankan setelah `supabase/schema.sql` dan setelah minimal satu user dibuat di Supabase Auth.

-- 1. Lihat daftar profile yang sudah otomatis terbentuk dari Auth.
select p.id, u.email, p.full_name, p.role, p.is_active, p.created_at
from public.profiles p
left join auth.users u on u.id = p.id
order by p.created_at asc;

-- 2. Promote user tertentu menjadi super_admin.
-- Ganti owner@toko.com dengan email user pertama Anda.
update public.profiles p
set role = 'super_admin',
    is_active = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('owner@toko.com');

-- 3. Verifikasi hasil promote.
select p.id, u.email, p.full_name, p.role, p.is_active
from public.profiles p
left join auth.users u on u.id = p.id
where lower(u.email) = lower('owner@toko.com');
