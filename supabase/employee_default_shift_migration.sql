alter table public.employees
  add column if not exists default_shift text;

update public.employees
set default_shift = lower(default_shift)
where default_shift is not null;

update public.employees
set default_shift = null
where default_shift is not null
  and default_shift not in ('pagi', 'siang');

update public.employees
set default_shift = 'pagi'
where lower(name) = 'erda ramdini'
  and default_shift is distinct from 'pagi';

alter table public.employees
  drop constraint if exists employees_default_shift_check;

alter table public.employees
  add constraint employees_default_shift_check
  check (default_shift is null or default_shift in ('pagi', 'siang'));
