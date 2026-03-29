create table if not exists public.employee_shift_separation_rules (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  restricted_employee_id uuid not null references public.employees (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint employee_shift_separation_rules_distinct_employees_check check (employee_id <> restricted_employee_id)
);

create index if not exists idx_employee_shift_separation_rules_employee_id on public.employee_shift_separation_rules (employee_id);
create index if not exists idx_employee_shift_separation_rules_restricted_employee_id on public.employee_shift_separation_rules (restricted_employee_id);
create unique index if not exists idx_employee_shift_separation_rules_pair_unique on public.employee_shift_separation_rules (
  least(employee_id::text, restricted_employee_id::text),
  greatest(employee_id::text, restricted_employee_id::text)
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

alter table public.employee_shift_separation_rules enable row level security;

grant select, insert, update, delete on public.employee_shift_separation_rules to authenticated;

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

notify pgrst, 'reload schema';
