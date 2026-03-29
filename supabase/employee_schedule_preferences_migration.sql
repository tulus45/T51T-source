alter table public.employees
  add column if not exists off_day_mode text default 'all';

alter table public.employees
  add column if not exists off_day_weekdays smallint[] default array[1, 2, 3, 4, 5, 6, 0]::smallint[];

alter table public.employees
  add column if not exists holiday_mandatory_off boolean default false;

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
  drop constraint if exists employees_off_day_mode_check;

alter table public.employees
  add constraint employees_off_day_mode_check
  check (off_day_mode in ('all', 'custom'));

alter table public.employees
  drop constraint if exists employees_off_day_weekdays_check;

alter table public.employees
  add constraint employees_off_day_weekdays_check
  check (cardinality(off_day_weekdays) > 0 and off_day_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);
