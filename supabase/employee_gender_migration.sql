begin;

alter table public.employees
  add column if not exists gender text;

alter table public.employees
  drop constraint if exists employees_gender_check;

alter table public.employees
  add constraint employees_gender_check
  check (gender is null or gender in ('laki-laki', 'perempuan'));

commit;
