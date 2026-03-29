import { supabase, supabaseProjectRef } from '../lib/supabaseClient';
import { unwrapResponse } from './baseService';

function normalizeRpcRow(data) {
  if (Array.isArray(data)) {
    return data[0] || null;
  }

  return data || null;
}

function getSalesReportsServiceErrorMessage(error, fallback) {
  const message = String(error?.message || '');

  if (message.includes('upsert_sales_month_target') || message.includes('upsert_sales_daily_report')) {
    return `Database Supabase belum diupdate atau schema cache belum refresh pada project ${supabaseProjectRef || 'aktif'}. Jalankan file supabase/sales_reports_rpc.sql di SQL Editor project itu, tunggu beberapa detik, lalu refresh aplikasi. Jika masih sama, jalankan SQL: NOTIFY pgrst, 'reload schema';`;
  }

  return message || fallback;
}

export async function getSalesMonthTarget(monthStart) {
  const { data, error } = await supabase
    .from('sales_monthly_targets')
    .select('*')
    .eq('month_start', monthStart)
    .maybeSingle();

  unwrapResponse(error, 'Gagal mengambil target sales bulanan.');

  return data || null;
}

export async function upsertSalesMonthTarget(payload) {
  const { data, error } = await supabase.rpc('upsert_sales_month_target', {
    p_month_start: payload?.month_start || null,
    p_target_amount: Number(payload?.target_amount || 0),
  });

  if (error) {
    throw new Error(getSalesReportsServiceErrorMessage(error, 'Gagal menyimpan target sales bulanan.'));
  }

  return normalizeRpcRow(data);
}

export async function listDailySalesReports(filters = {}) {
  let query = supabase.from('sales_daily_reports').select('*').order('date', { ascending: true });

  if (filters.dateFrom) {
    query = query.gte('date', filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte('date', filters.dateTo);
  }

  const { data, error } = await query;
  unwrapResponse(error, 'Gagal mengambil laporan sales harian.');

  return data || [];
}

export async function upsertDailySalesReport(payload) {
  const { data, error } = await supabase.rpc('upsert_sales_daily_report', {
    p_date: payload?.date || null,
    p_sales_amount: Number(payload?.sales_amount || 0),
    p_receipt_count: Number(payload?.receipt_count || 0),
  });

  if (error) {
    throw new Error(getSalesReportsServiceErrorMessage(error, 'Gagal menyimpan laporan sales harian.'));
  }

  return normalizeRpcRow(data);
}
