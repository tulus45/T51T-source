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
  v_current_receipt_count integer := 0;
  v_previous_receipt_count integer := 0;
  v_receipt_delta integer := 0;
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
  v_headline text := 'Projection belum bisa dianalisa.';
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

    select
      coalesce(max(sales_amount), 0),
      coalesce(max(receipt_count), 0)::int
    into v_spd, v_current_receipt_count
    from public.sales_daily_reports
    where date = v_latest_sales_date;

    select
      coalesce(max(sales_amount), 0),
      coalesce(max(receipt_count), 0)::int
    into v_spd_lm, v_previous_receipt_count
    from public.sales_daily_reports
    where date = v_comparable_previous_date;

    v_spd_delta := v_spd - v_spd_lm;
    v_receipt_delta := v_current_receipt_count - v_previous_receipt_count;

    if v_current_receipt_count > 0 then
      v_current_apc := round((v_spd / v_current_receipt_count)::numeric, 2);
    end if;

    if v_previous_receipt_count > 0 then
      v_previous_apc := round((v_spd_lm / v_previous_receipt_count)::numeric, 2);
    end if;

    v_apc_delta := v_current_apc - v_previous_apc;

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

    v_sales_value := v_spd_delta * v_day_count_in_month;
    v_receipt_value := v_receipt_delta * v_current_apc * v_day_count_in_month;
    v_apc_value := v_apc_delta * v_current_receipt_count * v_day_count_in_month;

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
        v_headline := 'Sales Projection relatif netral karena dampak struk dan APC saling menutup.';
        v_driver_label := 'Driver saling menutup';
      else
        v_headline := 'Sales Projection relatif stabil karena belum ada perubahan material pada driver utama.';
        v_driver_label := 'Pergerakan stabil';
      end if;
    elsif v_sales_direction = 'positive' then
      if v_receipt_direction = 'positive' and v_apc_direction = 'positive' then
        if v_dominant_driver = 'receipt' then
          v_headline := 'Sales Projection positif terutama ditopang kenaikan jumlah struk.';
          v_driver_label := 'Driver utama: Struk';
        elsif v_dominant_driver = 'apc' then
          v_headline := 'Sales Projection positif terutama ditopang kenaikan APC.';
          v_driver_label := 'Driver utama: APC';
        else
          v_headline := 'Sales Projection positif karena struk dan APC sama-sama menguat.';
          v_driver_label := 'Driver campuran';
        end if;
      elsif v_receipt_direction = 'positive' and v_apc_direction = 'negative' then
        v_headline := 'Sales Projection tetap positif karena kenaikan struk menutup pelemahan APC.';
        v_driver_label := 'Struk menahan penurunan APC';
      elsif v_receipt_direction = 'negative' and v_apc_direction = 'positive' then
        v_headline := 'Sales Projection tetap positif karena kenaikan APC menutup penurunan struk.';
        v_driver_label := 'APC menahan penurunan struk';
      elsif v_receipt_direction = 'positive' then
        v_headline := 'Sales Projection positif terutama ditopang perbaikan jumlah struk.';
        v_driver_label := 'Driver utama: Struk';
      elsif v_apc_direction = 'positive' then
        v_headline := 'Sales Projection positif terutama ditopang perbaikan APC.';
        v_driver_label := 'Driver utama: APC';
      end if;
    else
      if v_receipt_direction = 'negative' and v_apc_direction = 'negative' then
        if v_dominant_driver = 'receipt' then
          v_headline := 'Sales Projection negatif terutama ditekan penurunan jumlah struk.';
          v_driver_label := 'Driver utama: Struk';
        elsif v_dominant_driver = 'apc' then
          v_headline := 'Sales Projection negatif terutama ditekan penurunan APC.';
          v_driver_label := 'Driver utama: APC';
        else
          v_headline := 'Sales Projection negatif karena struk dan APC sama-sama melemah.';
          v_driver_label := 'Driver campuran';
        end if;
      elsif v_receipt_direction = 'negative' and v_apc_direction = 'positive' then
        v_headline := 'Sales Projection masih negatif karena penurunan struk lebih besar dari perbaikan APC.';
        v_driver_label := 'Struk menjadi penahan utama';
      elsif v_receipt_direction = 'positive' and v_apc_direction = 'negative' then
        v_headline := 'Sales Projection masih negatif karena penurunan APC lebih besar dari kenaikan struk.';
        v_driver_label := 'APC menjadi penahan utama';
      elsif v_receipt_direction = 'negative' then
        v_headline := 'Sales Projection negatif terutama ditekan penurunan jumlah struk.';
        v_driver_label := 'Driver utama: Struk';
      elsif v_apc_direction = 'negative' then
        v_headline := 'Sales Projection negatif terutama ditekan penurunan APC.';
        v_driver_label := 'Driver utama: APC';
      end if;
    end if;

    v_analysis_points := array_append(v_analysis_points, format('Nilai Sales Projection saat ini %s.', public.format_idr(v_sales_value)));
    v_analysis_points := array_append(v_analysis_points, format('Dampak dari perubahan struk terhadap projection sebesar %s.', public.format_idr(v_receipt_value)));
    v_analysis_points := array_append(v_analysis_points, format('Dampak dari perubahan APC terhadap projection sebesar %s.', public.format_idr(v_apc_value)));

    if v_sales_direction = 'neutral' then
      if v_receipt_direction <> 'neutral' and v_apc_direction <> 'neutral' and v_receipt_direction <> v_apc_direction then
        v_analysis_points := array_append(
          v_analysis_points,
          'Perubahan struk dan APC bergerak berlawanan arah, sehingga kenaikan salah satu faktor tertahan oleh penurunan faktor lainnya.'
        );
      else
        v_analysis_points := array_append(
          v_analysis_points,
          'Baik struk maupun APC belum menunjukkan perubahan yang cukup besar untuk menggeser projection secara material.'
        );
      end if;
    elsif v_receipt_direction = v_sales_direction and v_apc_direction = v_sales_direction then
      if v_dominant_driver = 'receipt' then
        v_analysis_points := array_append(v_analysis_points, 'Arah projection paling banyak ditentukan oleh perubahan jumlah struk.');
      elsif v_dominant_driver = 'apc' then
        v_analysis_points := array_append(v_analysis_points, 'Arah projection paling banyak ditentukan oleh perubahan APC.');
      else
        v_analysis_points := array_append(v_analysis_points, 'Struk dan APC berkontribusi relatif berimbang terhadap arah projection.');
      end if;
    elsif v_receipt_direction = v_sales_direction and v_apc_direction <> 'neutral' and v_apc_direction <> v_sales_direction then
      v_analysis_points := array_append(v_analysis_points, 'Jumlah struk menjadi pendorong utama, tetapi perubahan APC masih menahan hasil akhirnya.');
    elsif v_apc_direction = v_sales_direction and v_receipt_direction <> 'neutral' and v_receipt_direction <> v_sales_direction then
      v_analysis_points := array_append(v_analysis_points, 'APC menjadi pendorong utama, tetapi perubahan jumlah struk masih menahan hasil akhirnya.');
    end if;

    if abs(v_interaction_value) > (v_tolerance * 1.5) then
      v_analysis_points := array_append(
        v_analysis_points,
        format('Masih ada efek kombinasi struk x APC sekitar %s yang muncul saat dua driver berubah bersamaan.', public.format_idr(v_interaction_value))
      );
    end if;

    if v_sales_direction = 'negative' then
      if v_receipt_direction = 'negative' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Prioritaskan pemulihan jumlah struk: pastikan toko siap di jam ramai, kasir standby, antrean cepat terurai, dan item penarik traffic seperti kebutuhan harian serta produk promo tidak kosong.'
        );
      end if;

      if v_apc_direction = 'negative' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Perbaiki APC lewat bundling produk pelengkap, penawaran add-on di kasir, penguatan mix item bernilai lebih tinggi, dan suggestive selling yang konsisten oleh tim toko.'
        );
      end if;

      if v_receipt_direction = 'negative' and v_apc_direction = 'negative' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Karena dua driver sama-sama lemah, benahi traffic dan nilai belanja per struk secara paralel: display promo, ketersediaan fast moving, layanan kasir, dan add-on selling harus jalan bersamaan.'
        );
      elsif v_receipt_direction = 'positive' and v_apc_direction = 'negative' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Traffic sudah membantu, jadi fokus utama berikutnya adalah menaikkan nilai belanja per struk lewat bundling kebutuhan harian, cross-sell produk pelengkap, dan dorongan item promo.'
        );
      elsif v_receipt_direction = 'negative' and v_apc_direction = 'positive' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Penawaran produk pelengkap sudah membantu, jadi pertahankan pola itu dan fokus berikutnya adalah memulihkan transaksi lewat toko yang rapi, promo yang terlihat, dan stok item penarik kunjungan yang aman.'
        );
      end if;
    elsif v_sales_direction = 'positive' then
      if v_receipt_direction = 'positive' and v_apc_direction = 'positive' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Pertahankan dua driver yang sedang sehat dengan menjaga toko tetap ready, display promo aktif, ketersediaan item fast moving, dan disiplin add-on selling di kasir.'
        );
      elsif v_receipt_direction = 'positive' and v_apc_direction = 'negative' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Pertahankan aktivitas yang menaikkan struk, tetapi segera tutup kebocoran APC lewat bundling, cross-sell produk pelengkap, dan kontrol mix produk promo vs reguler.'
        );
      elsif v_receipt_direction = 'negative' and v_apc_direction = 'positive' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Pertahankan kualitas add-on selling dan nilai belanja per struk, sambil memulihkan jumlah transaksi lewat store ready, display depan, dan availability item kebutuhan harian.'
        );
      end if;

      if v_dominant_driver = 'receipt' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Driver utama saat ini adalah struk, jadi pastikan toko siap di jam sibuk, promo terlihat jelas, kasir cukup, dan item penarik kunjungan tidak kosong.'
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
          'Jangan tambah program traffic dulu; fokus perbaiki APC lewat bundling kebutuhan harian, add-on kasir, dan cross-sell supaya kenaikan struk benar-benar menjadi sales bersih.'
        );
      elsif v_receipt_direction = 'negative' and v_apc_direction = 'positive' then
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Jangan ubah pola add-on selling yang sudah bagus; fokus dorong jumlah transaksi lewat kerapian toko, visibilitas promo, dan ketersediaan item fast moving.'
        );
      else
        v_recommendation_points := array_append(
          v_recommendation_points,
          'Monitor harian cukup ketat karena projection masih datar; cek struk, APC, ketersediaan stok, eksekusi promo, dan layanan kasir per shift.'
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
