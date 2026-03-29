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
