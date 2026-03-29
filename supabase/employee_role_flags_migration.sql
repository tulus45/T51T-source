begin;

alter table public.employees
  add column if not exists kasir boolean default false;

alter table public.employees
  add column if not exists pimpinan_shift boolean default false;

alter table public.employees
  alter column kasir type boolean using case when lower(coalesce(kasir::text, '')) in ('kasir', 'true', 't', '1', 'yes', 'y', 'on') then true else false end;

alter table public.employees
  alter column kasir set default false;

update public.employees
set kasir = false
where kasir is null;

alter table public.employees
  alter column kasir set not null;

alter table public.employees
  alter column pimpinan_shift type boolean using case when lower(coalesce(pimpinan_shift::text, '')) in ('true', 't', '1', 'yes', 'y', 'on') then true else false end;

alter table public.employees
  alter column pimpinan_shift set default false;

update public.employees
set pimpinan_shift = false
where pimpinan_shift is null;

alter table public.employees
  alter column pimpinan_shift set not null;

alter table public.employees
  drop constraint if exists employees_kasir_check;

commit;
