create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'viewer' check (role in ('super_admin', 'admin', 'viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position text not null,
  phone text,
  email text,
  gender text,
  kasir boolean not null default false,
  pimpinan_shift boolean not null default false,
  shift_pagi boolean not null default true,
  shift_siang boolean not null default true,
  off_day_mode text not null default 'all',
  off_day_weekdays smallint[] not null default array[1, 2, 3, 4, 5, 6, 0]::smallint[],
  holiday_mandatory_off boolean not null default false,
  status text not null default 'aktif',
  hierarchy_order integer not null default 1,
  photo_url text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid()
);

alter table public.employees
  add column if not exists gender text;

alter table public.employees
  add column if not exists kasir boolean default false;

alter table public.employees
  add column if not exists pimpinan_shift boolean default false;

alter table public.employees
  add column if not exists off_day_mode text default 'all';

alter table public.employees
  add column if not exists off_day_weekdays smallint[] default array[1, 2, 3, 4, 5, 6, 0]::smallint[];

alter table public.employees
  add column if not exists holiday_mandatory_off boolean default false;

alter table public.employees
  add column if not exists shift_pagi boolean default true;

alter table public.employees
  add column if not exists shift_siang boolean default true;

alter table public.employees
  alter column kasir type boolean using case when lower(coalesce(kasir::text, '')) in ('kasir', 'true', 't', '1', 'yes', 'y', 'on') then true else false end;

alter table public.employees
  alter column kasir set default false;

update public.employees set kasir = false where kasir is null;

alter table public.employees
  alter column kasir set not null;

alter table public.employees
  alter column pimpinan_shift type boolean using case when lower(coalesce(pimpinan_shift::text, '')) in ('true', 't', '1', 'yes', 'y', 'on') then true else false end;

alter table public.employees
  alter column pimpinan_shift set default false;

update public.employees set pimpinan_shift = false where pimpinan_shift is null;

alter table public.employees
  alter column pimpinan_shift set not null;

update public.employees
set off_day_mode = 'all'
where off_day_mode is null
   or off_day_mode not in ('all', 'custom');

update public.employees
set off_day_weekdays = array[1, 2, 3, 4, 5, 6, 0]::smallint[]
where off_day_weekdays is null
   or cardinality(off_day_weekdays) = 0;

update public.employees
set holiday_mandatory_off = false
where holiday_mandatory_off is null;

update public.employees
set off_day_mode = 'custom',
    off_day_weekdays = array[6, 0]::smallint[]
where lower(name) = 'erda ramdini';

update public.employees
set shift_pagi = true,
    shift_siang = true
where shift_pagi is null
   or shift_siang is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'default_shift'
  ) then
    execute $sql$
      update public.employees
      set shift_pagi = case when lower(default_shift) = 'siang' then false else true end,
          shift_siang = case when lower(default_shift) = 'pagi' then false else true end
    $sql$;
  end if;
end
$$;

update public.employees
set shift_pagi = true,
    shift_siang = false
where lower(name) = 'erda ramdini';

alter table public.employees
  alter column shift_pagi set default true;

alter table public.employees
  alter column shift_pagi set not null;

alter table public.employees
  alter column shift_siang set default true;

alter table public.employees
  alter column shift_siang set not null;

alter table public.employees
  alter column off_day_mode set default 'all';

alter table public.employees
  alter column off_day_mode set not null;

alter table public.employees
  alter column off_day_weekdays set default array[1, 2, 3, 4, 5, 6, 0]::smallint[];

alter table public.employees
  alter column off_day_weekdays set not null;

alter table public.employees
  alter column holiday_mandatory_off set default false;

alter table public.employees
  alter column holiday_mandatory_off set not null;

alter table public.employees
  drop constraint if exists employees_gender_check;

alter table public.employees
  add constraint employees_gender_check
  check (gender is null or gender in ('laki-laki', 'perempuan'));

alter table public.employees
  drop constraint if exists employees_kasir_check;

alter table public.employees
  drop constraint if exists employees_status_check;

alter table public.employees
  add constraint employees_status_check
  check (status in ('aktif', 'cuti', 'mutasi', 'promosi', 'resign'));

alter table public.employees
  drop constraint if exists employees_default_shift_check;

alter table public.employees
  drop constraint if exists employees_shift_flags_check;

alter table public.employees
  add constraint employees_shift_flags_check
  check (shift_pagi or shift_siang);

alter table public.employees
  drop column if exists default_shift;

alter table public.employees
  drop constraint if exists employees_off_day_mode_check;

alter table public.employees
  add constraint employees_off_day_mode_check
  check (off_day_mode in ('all', 'custom'));

alter table public.employees
  drop constraint if exists employees_off_day_weekdays_check;

alter table public.employees
  add constraint employees_off_day_weekdays_check
  check (cardinality(off_day_weekdays) > 0 and off_day_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);


create table if not exists public.employee_shift_separation_rules (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  restricted_employee_id uuid not null references public.employees (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint employee_shift_separation_rules_distinct_employees_check check (employee_id <> restricted_employee_id)
);

insert into public.employee_shift_separation_rules (employee_id, restricted_employee_id)
select
  case when putri_id::text < bintang_id::text then putri_id else bintang_id end,
  case when putri_id::text < bintang_id::text then bintang_id else putri_id end
from (
  select putri.id as putri_id, bintang.id as bintang_id
  from public.employees putri
  cross join public.employees bintang
  where lower(putri.name) = 'putri lestari'
    and lower(bintang.name) = 'bintang noor azli r'
) pairs
where not exists (
  select 1
  from public.employee_shift_separation_rules rules
  where least(rules.employee_id::text, rules.restricted_employee_id::text) = least(pairs.putri_id::text, pairs.bintang_id::text)
    and greatest(rules.employee_id::text, rules.restricted_employee_id::text) = greatest(pairs.putri_id::text, pairs.bintang_id::text)
);

create table if not exists public.cash_reports (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(14,2) not null check (amount >= 0),
  category text not null,
  description text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  employee_id uuid not null references public.employees (id) on delete cascade,
  shift_type text not null check (shift_type in ('pagi', 'siang', 'malam', 'libur')),
  start_time time,
  end_time time,
  notes text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint schedules_employee_date_unique unique (date, employee_id),
  constraint schedules_time_validation check (
    (shift_type = 'libur' and start_time is null and end_time is null)
    or
    (shift_type <> 'libur' and start_time is not null and end_time is not null and start_time < end_time)
  )
);

create index if not exists idx_employees_position on public.employees (position);
create index if not exists idx_employees_hierarchy_order on public.employees (hierarchy_order);
create index if not exists idx_employee_shift_separation_rules_employee_id on public.employee_shift_separation_rules (employee_id);
create index if not exists idx_employee_shift_separation_rules_restricted_employee_id on public.employee_shift_separation_rules (restricted_employee_id);
create unique index if not exists idx_employee_shift_separation_rules_pair_unique on public.employee_shift_separation_rules (
  least(employee_id::text, restricted_employee_id::text),
  greatest(employee_id::text, restricted_employee_id::text)
);
create index if not exists idx_cash_reports_date on public.cash_reports (date desc);
create index if not exists idx_cash_reports_type on public.cash_reports (type);
create index if not exists idx_schedules_date on public.schedules (date);
create index if not exists idx_schedules_employee_id on public.schedules (employee_id);

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'viewer');
$$;

create or replace function public.is_active_profile()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
  );
$$;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_active_profile() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'viewer',
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.employee_shift_separation_rules enable row level security;
alter table public.cash_reports enable row level security;
alter table public.schedules enable row level security;

revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.employee_shift_separation_rules to authenticated;
grant select, insert, update, delete on public.cash_reports to authenticated;
grant select, insert, update, delete on public.schedules to authenticated;

drop policy if exists "Profiles select self or super admin" on public.profiles;
create policy "Profiles select self or super admin"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_app_role() = 'super_admin'
);

drop policy if exists "Profiles update by super admin" on public.profiles;
create policy "Profiles update by super admin"
on public.profiles
for update
to authenticated
using (public.current_app_role() = 'super_admin' and public.is_active_profile())
with check (public.current_app_role() = 'super_admin' and public.is_active_profile());

drop policy if exists "Employees read by active users" on public.employees;
create policy "Employees read by active users"
on public.employees
for select
to authenticated
using (public.is_active_profile());

drop policy if exists "Employees write by admin and super admin" on public.employees;
create policy "Employees write by admin and super admin"
on public.employees
for all
to authenticated
using (public.current_app_role() in ('admin', 'super_admin') and public.is_active_profile())
with check (public.current_app_role() in ('admin', 'super_admin') and public.is_active_profile());


drop policy if exists "Employee shift separation rules read by active users" on public.employee_shift_separation_rules;
create policy "Employee shift separation rules read by active users"
on public.employee_shift_separation_rules
for select
to authenticated
using (public.is_active_profile());

drop policy if exists "Employee shift separation rules write by admin and super admin" on public.employee_shift_separation_rules;
create policy "Employee shift separation rules write by admin and super admin"
on public.employee_shift_separation_rules
for all
to authenticated
using (public.current_app_role() in ('admin', 'super_admin') and public.is_active_profile())
with check (public.current_app_role() in ('admin', 'super_admin') and public.is_active_profile());

drop policy if exists "Cash reports read by active users" on public.cash_reports;
create policy "Cash reports read by active users"
on public.cash_reports
for select
to authenticated
using (public.is_active_profile());

drop policy if exists "Cash reports write by admin and super admin" on public.cash_reports;
create policy "Cash reports write by admin and super admin"
on public.cash_reports
for all
to authenticated
using (public.current_app_role() in ('admin', 'super_admin') and public.is_active_profile())
with check (public.current_app_role() in ('admin', 'super_admin') and public.is_active_profile());

drop policy if exists "Schedules read by active users" on public.schedules;
create policy "Schedules read by active users"
on public.schedules
for select
to authenticated
using (public.is_active_profile());

drop policy if exists "Schedules write by admin and super admin" on public.schedules;
create policy "Schedules write by admin and super admin"
on public.schedules
for all
to authenticated
using (public.current_app_role() in ('admin', 'super_admin') and public.is_active_profile())
with check (public.current_app_role() in ('admin', 'super_admin') and public.is_active_profile());

insert into storage.buckets (id, name, public)
values ('employee-photos', 'employee-photos', true)
on conflict (id) do nothing;

drop policy if exists "Employee photos public read" on storage.objects;
create policy "Employee photos public read"
on storage.objects
for select
using (bucket_id = 'employee-photos');

drop policy if exists "Employee photos write by admin and super admin" on storage.objects;
create policy "Employee photos write by admin and super admin"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'employee-photos'
  and public.current_app_role() in ('admin', 'super_admin')
  and public.is_active_profile()
);

drop policy if exists "Employee photos update by admin and super admin" on storage.objects;
create policy "Employee photos update by admin and super admin"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'employee-photos'
  and public.current_app_role() in ('admin', 'super_admin')
  and public.is_active_profile()
)
with check (
  bucket_id = 'employee-photos'
  and public.current_app_role() in ('admin', 'super_admin')
  and public.is_active_profile()
);

drop policy if exists "Employee photos delete by admin and super admin" on storage.objects;
create policy "Employee photos delete by admin and super admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'employee-photos'
  and public.current_app_role() in ('admin', 'super_admin')
  and public.is_active_profile()
);

comment on function public.current_app_role() is 'Mengambil role aplikasi dari tabel profiles untuk kebutuhan RLS.';
comment on function public.is_active_profile() is 'Validasi profile aktif sebelum memberikan akses ke data aplikasi.';

notify pgrst, 'reload schema';

create table if not exists public.sales_monthly_targets (
  id uuid primary key default gen_random_uuid(),
  month_start date not null,
  target_amount numeric(14,2) not null default 0 check (target_amount >= 0),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.sales_daily_reports (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  sales_amount numeric(14,2) not null default 0 check (sales_amount >= 0),
  receipt_count integer not null default 0 check (receipt_count >= 0),
  apc numeric(14,2) generated always as (
    case
      when receipt_count > 0 then round((sales_amount / receipt_count)::numeric, 2)
      else 0::numeric
    end
  ) stored,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_sales_monthly_targets_month_start on public.sales_monthly_targets (month_start);
create unique index if not exists idx_sales_daily_reports_date on public.sales_daily_reports (date);
create index if not exists idx_sales_daily_reports_created_at on public.sales_daily_reports (created_at desc);

alter table public.sales_monthly_targets enable row level security;
alter table public.sales_daily_reports enable row level security;

grant select, insert, update, delete on public.sales_monthly_targets to authenticated;
grant select, insert, update, delete on public.sales_daily_reports to authenticated;

drop policy if exists "Sales monthly targets read by active users" on public.sales_monthly_targets;
create policy "Sales monthly targets read by active users"
on public.sales_monthly_targets
for select
to authenticated
using (public.is_active_profile());

drop policy if exists "Sales monthly targets write by admin and super admin" on public.sales_monthly_targets;
create policy "Sales monthly targets write by admin and super admin"
on public.sales_monthly_targets
for all
to authenticated
using (public.current_app_role() in ('admin', 'super_admin') and public.is_active_profile())
with check (public.current_app_role() in ('admin', 'super_admin') and public.is_active_profile());

drop policy if exists "Sales daily reports read by active users" on public.sales_daily_reports;
create policy "Sales daily reports read by active users"
on public.sales_daily_reports
for select
to authenticated
using (public.is_active_profile());

drop policy if exists "Sales daily reports write by admin and super admin" on public.sales_daily_reports;
create policy "Sales daily reports write by admin and super admin"
on public.sales_daily_reports
for all
to authenticated
using (public.current_app_role() in ('admin', 'super_admin') and public.is_active_profile())
with check (public.current_app_role() in ('admin', 'super_admin') and public.is_active_profile());

notify pgrst, 'reload schema';

-- Dashboard summary RPC

create or replace function public.format_idr(value numeric)
returns text
language sql
immutable
as $$
  select case
    when coalesce(value, 0) < 0 then '-Rp ' || replace(to_char(abs(round(coalesce(value, 0))::numeric), 'FM999,999,999,999,999,990'), ',', '.')
    else 'Rp ' || replace(to_char(round(coalesce(value, 0))::numeric, 'FM999,999,999,999,999,990'), ',', '.')
  end;
$$;

grant execute on function public.format_idr(numeric) to authenticated;

create or replace function public.get_dashboard_summary()
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_today_date date := current_date;
  v_month_start date := date_trunc('month', v_today_date::timestamp)::date;
  v_month_end date := (date_trunc('month', v_today_date::timestamp) + interval '1 month - 1 day')::date;
  v_total_employees integer := 0;
  v_total_income numeric(14,2) := 0;
  v_total_expense numeric(14,2) := 0;
  v_balance numeric(14,2) := 0;
  v_target_amount numeric(14,2) := 0;
  v_total_sales numeric(14,2) := 0;
  v_total_receipts integer := 0;
  v_monthly_apc numeric(14,2) := 0;
  v_remaining_target numeric(14,2) := 0;
  v_latest_sales_date date;
  v_previous_month_start date;
  v_previous_month_end date;
  v_comparable_previous_date date;
  v_day_count_in_month integer := 0;
  v_spd numeric(14,2) := 0;
  v_spd_lm numeric(14,2) := 0;
  v_spd_delta numeric(14,2) := 0;
  v_current_receipt_count numeric(14,2) := 0;
  v_previous_receipt_count numeric(14,2) := 0;
  v_receipt_delta numeric(14,2) := 0;
  v_latest_input_day integer := 0;
  v_previous_comparable_day integer := 0;
  v_current_apc numeric(14,2) := 0;
  v_previous_apc numeric(14,2) := 0;
  v_apc_delta numeric(14,2) := 0;
  v_current_mtd_sales numeric(14,2) := 0;
  v_previous_mtd_sales numeric(14,2) := 0;
  v_current_mtd_receipts integer := 0;
  v_previous_mtd_receipts integer := 0;
  v_current_mtd_apc numeric(14,2) := 0;
  v_previous_mtd_apc numeric(14,2) := 0;
  v_sales_projection jsonb := null;
  v_receipt_impact_projection jsonb := null;
  v_apc_impact_projection jsonb := null;
  v_mtd_comparison jsonb := null;
  v_projection_analysis jsonb := null;
  v_today_schedules jsonb := jsonb_build_object(
    'date',
    v_today_date::text,
    'morning',
    '[]'::jsonb,
    'afternoon',
    '[]'::jsonb,
    'off',
    '[]'::jsonb
  );
  v_sales_value numeric(14,2) := 0;
  v_receipt_value numeric(14,2) := 0;
  v_apc_value numeric(14,2) := 0;
  v_interaction_value numeric(14,2) := 0;
  v_max_impact numeric(14,2) := 1;
  v_tolerance numeric(14,2) := 50000;
  v_sales_direction text := 'neutral';
  v_receipt_direction text := 'neutral';
  v_apc_direction text := 'neutral';
  v_receipt_abs numeric(14,2) := 0;
  v_apc_abs numeric(14,2) := 0;
  v_total_abs numeric(14,2) := 1;
  v_receipt_share numeric(14,6) := 0;
  v_apc_share numeric(14,6) := 0;
  v_dominant_driver text := 'mixed';
  v_headline text := 'Analisis hutang sales belum tersedia.';
  v_driver_label text := 'Driver belum terbaca';
  v_analysis_points text[] := array[]::text[];
  v_recommendation_points text[] := array[]::text[];
begin
  if not public.is_active_profile() then
    raise exception 'Akses dashboard tidak diizinkan.';
  end if;

  select count(*)::int
  into v_total_employees
  from public.employees
  where status = 'aktif';

  select
    coalesce(sum(case when type = 'income' then amount else 0 end), 0),
    coalesce(sum(case when type = 'expense' then amount else 0 end), 0)
  into v_total_income, v_total_expense
  from public.cash_reports;

  v_balance := v_total_income - v_total_expense;

  select coalesce(target_amount, 0)
  into v_target_amount
  from public.sales_monthly_targets
  where month_start = v_month_start
  limit 1;

  select
    coalesce(sum(sales_amount), 0),
    coalesce(sum(receipt_count), 0)::int
  into v_total_sales, v_total_receipts
  from public.sales_daily_reports
  where date between v_month_start and v_month_end;

  if v_total_receipts > 0 then
    v_monthly_apc := round((v_total_sales / v_total_receipts)::numeric, 2);
  end if;

  v_remaining_target := greatest(v_target_amount - v_total_sales, 0);

  with schedule_rows as (
    select
      s.id,
      s.shift_type,
      s.start_time,
      s.end_time,
      e.name as employee_name,
      e.position as employee_position,
      e.photo_url,
      case
        when e.pimpinan_shift then 0
        when e.kasir then 1
        else 2
      end as sort_priority
    from public.schedules s
    join public.employees e on e.id = s.employee_id
    where s.date = v_today_date
      and s.shift_type in ('pagi', 'siang', 'libur')
  )
  select jsonb_build_object(
    'date',
    v_today_date::text,
    'morning',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',
            id,
            'employeeName',
            employee_name,
            'employeePosition',
            employee_position,
            'photoUrl',
            photo_url,
            'shiftType',
            shift_type,
            'startTime',
            start_time,
            'endTime',
            end_time
          )
          order by sort_priority, employee_name
        )
        from schedule_rows
        where shift_type = 'pagi'
      ),
      '[]'::jsonb
    ),
    'afternoon',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',
            id,
            'employeeName',
            employee_name,
            'employeePosition',
            employee_position,
            'photoUrl',
            photo_url,
            'shiftType',
            shift_type,
            'startTime',
            start_time,
            'endTime',
            end_time
          )
          order by sort_priority, employee_name
        )
        from schedule_rows
        where shift_type = 'siang'
      ),
      '[]'::jsonb
    ),
    'off',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',
            id,
            'employeeName',
            employee_name,
            'employeePosition',
            employee_position,
            'photoUrl',
            photo_url,
            'shiftType',
            shift_type,
            'startTime',
            start_time,
            'endTime',
            end_time
          )
          order by sort_priority, employee_name
        )
        from schedule_rows
        where shift_type = 'libur'
      ),
      '[]'::jsonb
    )
  )
  into v_today_schedules;

  select date
  into v_latest_sales_date
  from public.sales_daily_reports
  order by date desc
  limit 1;

  if v_latest_sales_date is not null then
    v_previous_month_start := (date_trunc('month', v_latest_sales_date::timestamp) - interval '1 month')::date;
    v_previous_month_end := (date_trunc('month', v_latest_sales_date::timestamp) - interval '1 day')::date;
    v_comparable_previous_date := (
      v_previous_month_start + ((least(extract(day from v_latest_sales_date)::int, extract(day from v_previous_month_end)::int) - 1) * interval '1 day')
    )::date;
    v_day_count_in_month := extract(day from (date_trunc('month', v_latest_sales_date::timestamp) + interval '1 month - 1 day'))::int;
    v_latest_input_day := extract(day from v_latest_sales_date)::int;
    v_previous_comparable_day := extract(day from v_comparable_previous_date)::int;

    select
      coalesce(sum(sales_amount), 0),
      coalesce(sum(receipt_count), 0)::int
    into v_current_mtd_sales, v_current_mtd_receipts
    from public.sales_daily_reports
    where date between date_trunc('month', v_latest_sales_date::timestamp)::date and v_latest_sales_date;

    if v_current_mtd_receipts > 0 then
      v_current_mtd_apc := round((v_current_mtd_sales / v_current_mtd_receipts)::numeric, 2);
    end if;

    select
      coalesce(sum(sales_amount), 0),
      coalesce(sum(receipt_count), 0)::int
    into v_previous_mtd_sales, v_previous_mtd_receipts
    from public.sales_daily_reports
    where date between v_previous_month_start and v_comparable_previous_date;

    if v_previous_mtd_receipts > 0 then
      v_previous_mtd_apc := round((v_previous_mtd_sales / v_previous_mtd_receipts)::numeric, 2);
    end if;

    if v_latest_input_day > 0 then
      v_spd := round((v_current_mtd_sales / v_latest_input_day)::numeric, 2);
      v_current_receipt_count := round((v_current_mtd_receipts::numeric / v_latest_input_day)::numeric, 2);
    end if;

    if v_previous_comparable_day > 0 then
      v_spd_lm := round((v_previous_mtd_sales / v_previous_comparable_day)::numeric, 2);
      v_previous_receipt_count := round((v_previous_mtd_receipts::numeric / v_previous_comparable_day)::numeric, 2);
    end if;

    v_spd_delta := v_spd - v_spd_lm;
    v_receipt_delta := v_current_receipt_count - v_previous_receipt_count;
    v_current_apc := v_current_mtd_apc;
    v_previous_apc := v_previous_mtd_apc;
    v_apc_delta := v_current_apc - v_previous_apc;

    v_sales_value := (v_spd_lm - v_spd) * v_latest_input_day;
    v_receipt_value := (v_previous_receipt_count - v_current_receipt_count) * v_current_apc * v_latest_input_day;
    v_apc_value := (v_previous_apc - v_current_apc) * v_current_receipt_count * v_latest_input_day;

    v_sales_projection := jsonb_build_object(
      'latestInputDate',
      v_latest_sales_date::text,
      'previousComparableDate',
      v_comparable_previous_date::text,
      'spd',
      v_spd,
      'spdLm',
      v_spd_lm,
      'spdDelta',
      v_spd_delta,
      'dayCountInMonth',
      v_day_count_in_month,
      'projectionValue',
      v_sales_value
    );

    v_receipt_impact_projection := jsonb_build_object(
      'latestInputDate',
      v_latest_sales_date::text,
      'previousComparableDate',
      v_comparable_previous_date::text,
      'currentReceiptCount',
      v_current_receipt_count,
      'previousReceiptCount',
      v_previous_receipt_count,
      'receiptDelta',
      v_receipt_delta,
      'currentApc',
      v_current_apc,
      'dayCountInMonth',
      v_day_count_in_month,
      'projectionValue',
      v_receipt_value
    );

    v_apc_impact_projection := jsonb_build_object(
      'latestInputDate',
      v_latest_sales_date::text,
      'previousComparableDate',
      v_comparable_previous_date::text,
      'currentReceiptCount',
      v_current_receipt_count,
      'currentApc',
      v_current_apc,
      'previousApc',
      v_previous_apc,
      'apcDelta',
      v_apc_delta,
      'dayCountInMonth',
      v_day_count_in_month,
      'projectionValue',
      v_apc_value
    );

    v_mtd_comparison := jsonb_build_object(
      'latestInputDate',
      v_latest_sales_date::text,
      'previousComparableDate',
      v_comparable_previous_date::text,
      'currentMtdSales',
      v_current_mtd_sales,
      'previousMtdSales',
      v_previous_mtd_sales,
      'currentMtdReceipts',
      v_current_mtd_receipts,
      'previousMtdReceipts',
      v_previous_mtd_receipts,
      'currentMtdApc',
      v_current_mtd_apc,
      'previousMtdApc',
      v_previous_mtd_apc
    );

    v_interaction_value := v_sales_value - v_receipt_value - v_apc_value;
    v_max_impact := greatest(abs(v_sales_value), abs(v_receipt_value), abs(v_apc_value), 1);
    v_tolerance := greatest(50000, v_max_impact * 0.03);

    v_sales_direction := case
      when v_sales_value > v_tolerance then 'positive'
      when v_sales_value < (-1 * v_tolerance) then 'negative'
      else 'neutral'
    end;

    v_receipt_direction := case
      when v_receipt_value > v_tolerance then 'positive'
      when v_receipt_value < (-1 * v_tolerance) then 'negative'
      else 'neutral'
    end;

    v_apc_direction := case
      when v_apc_value > v_tolerance then 'positive'
      when v_apc_value < (-1 * v_tolerance) then 'negative'
      else 'neutral'
    end;

    v_receipt_abs := abs(v_receipt_value);
    v_apc_abs := abs(v_apc_value);
    v_total_abs := coalesce(nullif(v_receipt_abs + v_apc_abs, 0), 1);
    v_receipt_share := coalesce(v_receipt_abs / nullif(v_total_abs, 0), 0);
    v_apc_share := coalesce(v_apc_abs / nullif(v_total_abs, 0), 0);

    if v_receipt_share >= 0.6 then
      v_dominant_driver := 'receipt';
    elsif v_apc_share >= 0.6 then
      v_dominant_driver := 'apc';
    else
      v_dominant_driver := 'mixed';
    end if;

    if v_sales_direction = 'neutral' then
      if v_receipt_direction <> 'neutral' and v_apc_direction <> 'neutral' and v_receipt_direction <> v_apc_direction then
        v_headline := 'Hutang sales relatif netral karena dampak STD dan APC saling menutup.';
        v_driver_label := 'Driver saling menutup';
      else
        v_headline := 'Hutang sales relatif stabil karena belum ada perubahan material pada driver utama.';
        v_driver_label := 'Pergerakan stabil';
      end if;
    elsif v_sales_direction = 'positive' then
      if v_receipt_direction = 'positive' and v_apc_direction = 'positive' then
        if v_dominant_driver = 'receipt' then
          v_headline := 'Hutang sales terutama dipicu penurunan STD.';
          v_driver_label := 'Driver utama: STD';
        elsif v_dominant_driver = 'apc' then
          v_headline := 'Hutang sales terutama dipicu penurunan APC.';
          v_driver_label := 'Driver utama: APC';
        else
          v_headline := 'Hutang sales membesar karena STD dan APC sama-sama melemah.';
          v_driver_label := 'Driver campuran';
        end if;
      elsif v_receipt_direction = 'positive' and v_apc_direction = 'negative' then
        v_headline := 'Hutang sales masih terbentuk karena penurunan STD lebih besar dari perbaikan APC.';
        v_driver_label := 'STD menjadi penahan utama';
      elsif v_receipt_direction = 'negative' and v_apc_direction = 'positive' then
        v_headline := 'Hutang sales masih terbentuk karena penurunan APC lebih besar dari perbaikan STD.';
        v_driver_label := 'APC menjadi penahan utama';
      elsif v_receipt_direction = 'positive' then
        v_headline := 'Hutang sales terutama dipicu penurunan STD.';
        v_driver_label := 'Driver utama: STD';
      elsif v_apc_direction = 'positive' then
        v_headline := 'Hutang sales terutama dipicu penurunan APC.';
        v_driver_label := 'Driver utama: APC';
      end if;
    else
      if v_receipt_direction = 'negative' and v_apc_direction = 'negative' then
        if v_dominant_driver = 'receipt' then
          v_headline := 'Hutang sales membaik terutama ditopang kenaikan STD.';
          v_driver_label := 'Driver utama: STD';
        elsif v_dominant_driver = 'apc' then
          v_headline := 'Hutang sales membaik terutama ditopang kenaikan APC.';
          v_driver_label := 'Driver utama: APC';
        else
          v_headline := 'Hutang sales membaik karena STD dan APC sama-sama menguat.';
          v_driver_label := 'Driver campuran';
        end if;
      elsif v_receipt_direction = 'positive' and v_apc_direction = 'negative' then
        v_headline := 'Hutang sales tetap terkendali karena kenaikan APC menutup penurunan STD.';
        v_driver_label := 'APC menahan penurunan STD';
      elsif v_receipt_direction = 'negative' and v_apc_direction = 'positive' then
        v_headline := 'Hutang sales tetap terkendali karena kenaikan STD menutup penurunan APC.';
        v_driver_label := 'STD menahan penurunan APC';
      elsif v_receipt_direction = 'negative' then
        v_headline := 'Hutang sales membaik terutama ditopang kenaikan STD.';
        v_driver_label := 'Driver utama: STD';
      elsif v_apc_direction = 'negative' then
        v_headline := 'Hutang sales membaik terutama ditopang kenaikan APC.';
        v_driver_label := 'Driver utama: APC';
      end if;
    end if;

    v_analysis_points := array_append(v_analysis_points, format('Nilai hutang sales saat ini %s.', public.format_idr(v_sales_value)));
    v_analysis_points := array_append(v_analysis_points, format('Dampak dari perubahan STD terhadap hutang sales sebesar %s.', public.format_idr(v_receipt_value)));
    v_analysis_points := array_append(v_analysis_points, format('Dampak dari perubahan APC terhadap hutang sales sebesar %s.', public.format_idr(v_apc_value)));

    if v_sales_direction = 'neutral' then
      if v_receipt_direction <> 'neutral' and v_apc_direction <> 'neutral' and v_receipt_direction <> v_apc_direction then
        v_analysis_points := array_append(
          v_analysis_points,
          'STD dan APC bergerak berlawanan arah, sehingga perbaikan salah satu faktor masih tertahan oleh pelemahan faktor lainnya.'
        );
      else
        v_analysis_points := array_append(
          v_analysis_points,
          'Baik STD maupun APC belum menunjukkan perubahan yang cukup besar untuk menggeser hutang sales secara material.'
        );
      end if;
    elsif v_receipt_direction = v_sales_direction and v_apc_direction = v_sales_direction then
      if v_dominant_driver = 'receipt' then
        v_analysis_points := array_append(v_analysis_points, 'Arah hutang sales paling banyak ditentukan oleh perubahan STD.');
      elsif v_dominant_driver = 'apc' then
        v_analysis_points := array_append(v_analysis_points, 'Arah hutang sales paling banyak ditentukan oleh perubahan APC.');
      else
        v_analysis_points := array_append(v_analysis_points, 'STD dan APC berkontribusi relatif berimbang terhadap arah hutang sales.');
      end if;
    elsif v_receipt_direction = v_sales_direction and v_apc_direction <> 'neutral' and v_apc_direction <> v_sales_direction then
      v_analysis_points := array_append(v_analysis_points, 'Perubahan STD menjadi driver utama, sementara APC bergerak berlawanan arah dan menahan hasil akhirnya.');
    elsif v_apc_direction = v_sales_direction and v_receipt_direction <> 'neutral' and v_receipt_direction <> v_sales_direction then
      v_analysis_points := array_append(v_analysis_points, 'Perubahan APC menjadi driver utama, sementara STD bergerak berlawanan arah dan menahan hasil akhirnya.');
    end if;

    if abs(v_interaction_value) > (v_tolerance * 1.5) then
      v_analysis_points := array_append(
        v_analysis_points,
        format('Masih ada efek kombinasi STD x APC sekitar %s yang muncul saat dua driver berubah bersamaan.', public.format_idr(v_interaction_value))
      );
    end if; 

    if v_sales_direction = 'positive' then
      if v_receipt_direction = 'positive' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Prioritaskan pemulihan STD: pastikan toko siap di jam ramai, kasir standby, antrean cepat terurai, dan item penarik traffic seperti kebutuhan harian serta produk promo tidak kosong.'
        );
      end if;

      if v_apc_direction = 'positive' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Perbaiki APC lewat bundling produk pelengkap, penawaran add-on di kasir, penguatan mix item bernilai lebih tinggi, dan suggestive selling yang konsisten oleh tim toko.'
        );
      end if;

      if v_receipt_direction = 'positive' and v_apc_direction = 'positive' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Karena STD dan APC sama-sama lemah, benahi traffic dan nilai belanja per transaksi secara paralel: display promo, ketersediaan fast moving, layanan kasir, dan add-on selling harus jalan bersamaan.'
        );
      elsif v_receipt_direction = 'negative' and v_apc_direction = 'positive' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'STD sudah membantu menekan gap, jadi fokus utama berikutnya adalah menaikkan APC lewat bundling kebutuhan harian, cross-sell produk pelengkap, dan dorongan item promo.'
        );
      elsif v_receipt_direction = 'positive' and v_apc_direction = 'negative' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'APC sudah membantu menekan gap, jadi fokus berikutnya adalah memulihkan STD lewat toko yang rapi, promo yang terlihat, dan stok item penarik kunjungan yang aman.'
        );
      end if;
    elsif v_sales_direction = 'negative' then
      if v_receipt_direction = 'negative' and v_apc_direction = 'negative' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Pertahankan dua driver yang sedang sehat dengan menjaga toko tetap ready, display promo aktif, ketersediaan item fast moving, dan disiplin add-on selling di kasir.'
        );
      elsif v_receipt_direction = 'negative' and v_apc_direction = 'positive' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Pertahankan aktivitas yang mendorong STD, tetapi segera tutup kebocoran APC lewat bundling, cross-sell produk pelengkap, dan kontrol mix produk promo vs reguler.'
        );
      elsif v_receipt_direction = 'positive' and v_apc_direction = 'negative' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Pertahankan kualitas bundling dan nilai belanja per transaksi, sambil memulihkan STD lewat store ready, display depan, dan availability item kebutuhan harian.'
        );
      end if;

      if v_dominant_driver = 'receipt' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Driver utama saat ini adalah STD, jadi pastikan toko siap di jam sibuk, promo terlihat jelas, kasir cukup, dan item penarik kunjungan tidak kosong.'
        );
      elsif v_dominant_driver = 'apc' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Driver utama saat ini adalah APC, jadi jaga konsistensi penawaran produk pelengkap, bundling hemat, dan ketersediaan item bernilai lebih tinggi di area jual.'
        );
      end if;
    else
      if v_receipt_direction = 'positive' and v_apc_direction = 'negative' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Jangan ubah pola bundling yang sudah bagus; fokus dorong pemulihan STD lewat kerapian toko, visibilitas promo, dan ketersediaan item fast moving.'
        );
      elsif v_receipt_direction = 'negative' and v_apc_direction = 'positive' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Jangan tambah program traffic dulu; fokus perbaiki APC lewat bundling kebutuhan harian, add-on kasir, dan cross-sell supaya STD yang sudah bagus bisa menghasilkan sales lebih bersih.'
        );
      else
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Monitor harian cukup ketat karena hutang sales masih datar; cek STD, APC, ketersediaan stok, eksekusi promo, dan layanan kasir per shift.'
        );
      end if;

      v_recommendation_points := array_append(
        v_recommendation_points,
        'Pertahankan driver yang sedang kuat dan koreksi faktor penahan tanpa mengganggu ritme operasional toko yang sudah berjalan baik.'
      );
    end if;

    v_projection_analysis := jsonb_build_object(
      'headline',
      v_headline,
      'driverLabel',
      v_driver_label,
      'analysisPoints',
      to_jsonb(v_analysis_points),
      'recommendationPoints',
      to_jsonb(v_recommendation_points)
    );
  end if;

  return jsonb_build_object(
    'totalEmployees',
    v_total_employees,
    'totalIncome',
    v_total_income,
    'totalExpense',
    v_total_expense,
    'balance',
    v_balance,
    'salesSummary',
    jsonb_build_object(
      'monthStart',
      v_month_start::text,
      'targetAmount',
      v_target_amount,
      'totalSales',
      v_total_sales,
      'receiptCount',
      v_total_receipts,
      'monthlyApc',
      v_monthly_apc,
      'remainingTarget',
      v_remaining_target
    ),
    'projections',
    jsonb_build_object(
      'salesProjection',
      v_sales_projection,
      'receiptImpactProjection',
      v_receipt_impact_projection,
      'apcImpactProjection',
      v_apc_impact_projection
    ),
    'mtdComparison',
    v_mtd_comparison,
    'projectionAnalysis',
    v_projection_analysis,
    'todaySchedules',
    v_today_schedules
  );
end;
$$;

grant execute on function public.get_dashboard_summary() to authenticated;

comment on function public.format_idr(numeric) is 'Formatter ringkas Rupiah untuk kebutuhan analisa dashboard.';
comment on function public.get_dashboard_summary() is 'Mengembalikan ringkasan dashboard toko beserta projection sales, analisa, dan jadwal hari ini.';

notify pgrst, 'reload schema';

-- Sales reports RPC

create or replace function public.upsert_sales_month_target(
  p_month_start date,
  p_target_amount numeric
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_row public.sales_monthly_targets;
begin
  if not public.is_active_profile() or public.current_app_role() not in ('admin', 'super_admin') then
    raise exception 'Akses menyimpan target sales tidak diizinkan.';
  end if;

  if p_month_start is null then
    raise exception 'Bulan target sales wajib diisi.';
  end if;

  if coalesce(p_target_amount, 0) < 0 then
    raise exception 'Target sales tidak boleh kurang dari nol.';
  end if;

  insert into public.sales_monthly_targets (month_start, target_amount, created_by)
  values (p_month_start, coalesce(p_target_amount, 0), auth.uid())
  on conflict (month_start)
  do update set target_amount = excluded.target_amount
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.upsert_sales_month_target(date, numeric) to authenticated;

create or replace function public.upsert_sales_daily_report(
  p_date date,
  p_sales_amount numeric,
  p_receipt_count integer
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_row public.sales_daily_reports;
begin
  if not public.is_active_profile() or public.current_app_role() not in ('admin', 'super_admin') then
    raise exception 'Akses menyimpan sales harian tidak diizinkan.';
  end if;

  if p_date is null then
    raise exception 'Tanggal sales harian wajib diisi.';
  end if;

  if coalesce(p_sales_amount, 0) < 0 then
    raise exception 'Nilai sales tidak boleh kurang dari nol.';
  end if;

  if coalesce(p_receipt_count, 0) < 0 then
    raise exception 'Jumlah struk tidak boleh kurang dari nol.';
  end if;

  insert into public.sales_daily_reports (date, sales_amount, receipt_count, created_by)
  values (p_date, coalesce(p_sales_amount, 0), coalesce(p_receipt_count, 0), auth.uid())
  on conflict (date)
  do update set
    sales_amount = excluded.sales_amount,
    receipt_count = excluded.receipt_count
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.upsert_sales_daily_report(date, numeric, integer) to authenticated;

create or replace function public.delete_sales_daily_report(
  p_date date
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_row public.sales_daily_reports;
begin
  if not public.is_active_profile() or public.current_app_role() not in ('admin', 'super_admin') then
    raise exception 'Akses menghapus sales harian tidak diizinkan.';
  end if;

  if p_date is null then
    raise exception 'Tanggal sales harian wajib diisi.';
  end if;

  delete from public.sales_daily_reports
  where date = p_date
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.delete_sales_daily_report(date) to authenticated;

comment on function public.upsert_sales_month_target(date, numeric) is 'Menyimpan target sales bulanan melalui RPC agar write tidak langsung dari client ke tabel.';
comment on function public.upsert_sales_daily_report(date, numeric, integer) is 'Menyimpan sales harian melalui RPC agar write tidak langsung dari client ke tabel.';
comment on function public.delete_sales_daily_report(date) is 'Menghapus sales harian melalui RPC agar tanggal yang salah input bisa kembali kosong.';

notify pgrst, 'reload schema';

-- Cash reports security hardening

drop policy if exists "Cash reports read by active users" on public.cash_reports;
drop policy if exists "Cash reports read by admin and super admin" on public.cash_reports;
create policy "Cash reports read by admin and super admin"
on public.cash_reports
for select
to authenticated
using (public.current_app_role() in ('admin', 'super_admin') and public.is_active_profile());

create or replace function public.list_cash_reports(
  p_type text default null,
  p_date_from date default null,
  p_date_to date default null
)
returns setof public.cash_reports
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_active_profile() then
    raise exception 'Akses melihat laporan kas tidak diizinkan.';
  end if;

  return query
  select cr.*
  from public.cash_reports cr
  where (p_type is null or p_type = '' or p_type = 'all' or cr.type = p_type)
    and (p_date_from is null or cr.date >= p_date_from)
    and (p_date_to is null or cr.date <= p_date_to)
  order by cr.date desc, cr.created_at desc;
end;
$$;

grant execute on function public.list_cash_reports(text, date, date) to authenticated;

create or replace function public.create_cash_report(
  p_date date,
  p_type text,
  p_amount numeric,
  p_category text,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.cash_reports;
begin
  if not public.is_active_profile() or public.current_app_role() not in ('admin', 'super_admin') then
    raise exception 'Akses menambah laporan kas tidak diizinkan.';
  end if;

  if p_date is null then
    raise exception 'Tanggal transaksi kas wajib diisi.';
  end if;

  if p_type not in ('income', 'expense') then
    raise exception 'Jenis transaksi kas tidak valid.';
  end if;

  if coalesce(p_amount, 0) < 0 then
    raise exception 'Nominal transaksi kas tidak boleh kurang dari nol.';
  end if;

  if nullif(trim(coalesce(p_category, '')), '') is null then
    raise exception 'Kategori transaksi kas wajib diisi.';
  end if;

  insert into public.cash_reports (date, type, amount, category, description, created_by)
  values (
    p_date,
    p_type,
    coalesce(p_amount, 0),
    trim(p_category),
    nullif(trim(coalesce(p_description, '')), ''),
    auth.uid()
  )
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.create_cash_report(date, text, numeric, text, text) to authenticated;

create or replace function public.update_cash_report(
  p_id uuid,
  p_date date,
  p_type text,
  p_amount numeric,
  p_category text,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.cash_reports;
begin
  if not public.is_active_profile() or public.current_app_role() not in ('admin', 'super_admin') then
    raise exception 'Akses memperbarui laporan kas tidak diizinkan.';
  end if;

  if p_id is null then
    raise exception 'ID transaksi kas tidak valid.';
  end if;

  if p_date is null then
    raise exception 'Tanggal transaksi kas wajib diisi.';
  end if;

  if p_type not in ('income', 'expense') then
    raise exception 'Jenis transaksi kas tidak valid.';
  end if;

  if coalesce(p_amount, 0) < 0 then
    raise exception 'Nominal transaksi kas tidak boleh kurang dari nol.';
  end if;

  if nullif(trim(coalesce(p_category, '')), '') is null then
    raise exception 'Kategori transaksi kas wajib diisi.';
  end if;

  update public.cash_reports
  set date = p_date,
      type = p_type,
      amount = coalesce(p_amount, 0),
      category = trim(p_category),
      description = nullif(trim(coalesce(p_description, '')), '')
  where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Transaksi kas tidak ditemukan.';
  end if;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.update_cash_report(uuid, date, text, numeric, text, text) to authenticated;

create or replace function public.delete_cash_report(
  p_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_id uuid;
begin
  if not public.is_active_profile() or public.current_app_role() not in ('admin', 'super_admin') then
    raise exception 'Akses menghapus laporan kas tidak diizinkan.';
  end if;

  if p_id is null then
    raise exception 'ID transaksi kas tidak valid.';
  end if;

  delete from public.cash_reports
  where id = p_id
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'Transaksi kas tidak ditemukan.';
  end if;

  return true;
end;
$$;

grant execute on function public.delete_cash_report(uuid) to authenticated;

comment on function public.list_cash_reports(text, date, date) is 'Mengambil laporan kas read-only melalui RPC agar viewer tidak perlu select langsung ke tabel.';
comment on function public.create_cash_report(date, text, numeric, text, text) is 'Menambah laporan kas melalui RPC agar write tidak langsung dari client ke tabel.';
comment on function public.update_cash_report(uuid, date, text, numeric, text, text) is 'Memperbarui laporan kas melalui RPC agar write tidak langsung dari client ke tabel.';
comment on function public.delete_cash_report(uuid) is 'Menghapus laporan kas melalui RPC agar delete tidak langsung dari client ke tabel.';

notify pgrst, 'reload schema';



