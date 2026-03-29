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



