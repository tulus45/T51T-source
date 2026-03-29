alter table public.employees
  add column if not exists shift_pagi boolean default true;

alter table public.employees
  add column if not exists shift_siang boolean default true;

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
  drop constraint if exists employees_default_shift_check;

alter table public.employees
  drop constraint if exists employees_shift_flags_check;

alter table public.employees
  add constraint employees_shift_flags_check
  check (shift_pagi or shift_siang);

alter table public.employees
  drop column if exists default_shift;

notify pgrst, 'reload schema';
