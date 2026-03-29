begin;

-- Seed sample employees
with actor as (
  select id
  from public.profiles
  where role in ('super_admin', 'admin')
  order by case when role = 'super_admin' then 0 else 1 end, created_at
  limit 1
), employee_seed(name, position, phone, email, gender, kasir, pimpinan_shift, shift_pagi, shift_siang, off_day_mode, off_day_weekdays, holiday_mandatory_off, status, hierarchy_order, photo_url) as (
  values
    ('Tulus Santoso', 'Store Manager', '081234567890', 'tulus.manager@store.local', 'laki-laki', false, true, true, false, 'all', array[1, 2, 3, 4, 5, 6, 0]::smallint[], false, 'aktif', 1, null),
    ('Mira Lestari', 'Supervisor Operasional', '081234567891', 'mira.ops@store.local', 'perempuan', false, true, false, true, 'all', array[1, 2, 3, 4, 5, 6, 0]::smallint[], false, 'aktif', 2, null),
    ('Rian Saputra', 'Kasir Senior', '081234567892', 'rian.kasir@store.local', 'laki-laki', true, false, true, false, 'all', array[1, 2, 3, 4, 5, 6, 0]::smallint[], false, 'aktif', 3, null),
    ('Salsa Permata', 'Kasir', '081234567893', 'salsa.kasir@store.local', 'perempuan', true, false, false, true, 'all', array[1, 2, 3, 4, 5, 6, 0]::smallint[], false, 'aktif', 4, null),
    ('Bagus Pratama', 'Staf Gudang', '081234567894', 'bagus.gudang@store.local', 'laki-laki', false, false, true, false, 'custom', array[6, 0]::smallint[], true, 'aktif', 5, null),
    ('Nadia Putri', 'Customer Service', '081234567895', 'nadia.cs@store.local', 'perempuan', false, false, false, true, 'all', array[1, 2, 3, 4, 5, 6, 0]::smallint[], false, 'cuti', 6, null)
)
insert into public.employees (name, position, phone, email, gender, kasir, pimpinan_shift, shift_pagi, shift_siang, off_day_mode, off_day_weekdays, holiday_mandatory_off, status, hierarchy_order, photo_url, created_by)
select s.name, s.position, s.phone, s.email, s.gender, s.kasir, s.pimpinan_shift, s.shift_pagi, s.shift_siang, s.off_day_mode, s.off_day_weekdays, s.holiday_mandatory_off, s.status, s.hierarchy_order, s.photo_url, (select id from actor)
from employee_seed s
where not exists (
  select 1
  from public.employees e
  where lower(coalesce(e.email, '')) = lower(coalesce(s.email, ''))
);

-- Seed sample cash reports
with actor as (
  select id
  from public.profiles
  where role in ('super_admin', 'admin')
  order by case when role = 'super_admin' then 0 else 1 end, created_at
  limit 1
), cash_seed(date, type, amount, category, description) as (
  values
    (current_date - 5, 'income', 3500000, 'Penjualan Harian', 'Omzet penjualan akhir pekan'),
    (current_date - 4, 'expense', 450000, 'Belanja Stok', 'Pembelian minuman dan snack'),
    (current_date - 3, 'income', 2800000, 'Penjualan Harian', 'Penjualan weekday'),
    (current_date - 2, 'expense', 275000, 'Operasional', 'Biaya kebersihan dan ATK'),
    (current_date - 1, 'income', 4100000, 'Penjualan Harian', 'Penjualan promo toko')
)
insert into public.cash_reports (date, type, amount, category, description, created_by)
select s.date, s.type, s.amount, s.category, s.description, (select id from actor)
from cash_seed s
where not exists (
  select 1
  from public.cash_reports c
  where c.date = s.date
    and c.type = s.type
    and c.category = s.category
    and c.amount = s.amount
);

-- Seed sample schedules for tomorrow
with actor as (
  select id
  from public.profiles
  where role in ('super_admin', 'admin')
  order by case when role = 'super_admin' then 0 else 1 end, created_at
  limit 1
), target_employees as (
  select id, name
  from public.employees
  where name in ('Tulus Santoso', 'Mira Lestari', 'Rian Saputra', 'Salsa Permata', 'Bagus Pratama')
), schedule_seed(name, shift_type, start_time, end_time, notes) as (
  values
    ('Tulus Santoso', 'pagi', '08:00'::time, '16:00'::time, 'Monitor operasional dan briefing tim'),
    ('Mira Lestari', 'siang', '12:00'::time, '20:00'::time, 'Pendampingan stok dan closing shift'),
    ('Rian Saputra', 'pagi', '08:00'::time, '16:00'::time, 'Penanggung jawab kasir utama'),
    ('Salsa Permata', 'malam', '16:00'::time, '23:00'::time, 'Kasir closing'),
    ('Bagus Pratama', 'libur', null::time, null::time, 'Libur bergilir')
)
insert into public.schedules (date, employee_id, shift_type, start_time, end_time, notes, created_by)
select current_date + 1, e.id, s.shift_type, s.start_time, s.end_time, s.notes, (select id from actor)
from schedule_seed s
join target_employees e on e.name = s.name
where not exists (
  select 1
  from public.schedules sch
  where sch.date = current_date + 1
    and sch.employee_id = e.id
);

commit;
begin;

with actor as (
  select id
  from public.profiles
  where role in ('super_admin', 'admin')
  order by case when role = 'super_admin' then 0 else 1 end, created_at
  limit 1
)
insert into public.sales_monthly_targets (month_start, target_amount, created_by)
select date_trunc('month', current_date)::date, 75000000, (select id from actor)
where not exists (
  select 1
  from public.sales_monthly_targets t
  where t.month_start = date_trunc('month', current_date)::date
);

with actor as (
  select id
  from public.profiles
  where role in ('super_admin', 'admin')
  order by case when role = 'super_admin' then 0 else 1 end, created_at
  limit 1
), sales_seed(date, sales_amount, receipt_count) as (
  values
    (current_date - 5, 4200000, 84),
    (current_date - 4, 3850000, 79),
    (current_date - 3, 4680000, 91),
    (current_date - 2, 3525000, 74),
    (current_date - 1, 5010000, 96)
)
insert into public.sales_daily_reports (date, sales_amount, receipt_count, created_by)
select s.date, s.sales_amount, s.receipt_count, (select id from actor)
from sales_seed s
where date_trunc('month', s.date)::date = date_trunc('month', current_date)::date
  and not exists (
    select 1
    from public.sales_daily_reports r
    where r.date = s.date
  );

commit;
