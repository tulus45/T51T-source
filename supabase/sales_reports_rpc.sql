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

comment on function public.upsert_sales_month_target(date, numeric) is 'Menyimpan target sales bulanan melalui RPC agar write tidak langsung dari client ke tabel.';
comment on function public.upsert_sales_daily_report(date, numeric, integer) is 'Menyimpan sales harian melalui RPC agar write tidak langsung dari client ke tabel.';

notify pgrst, 'reload schema';
