import { supabase, supabaseProjectRef } from '../lib/supabaseClient';

function normalizeRpcRow(data) {
  if (Array.isArray(data)) {
    return data[0] || null;
  }

  return data || null;
}

function getCashReportsServiceErrorMessage(error, fallback) {
  const message = String(error?.message || '');

  if (
    message.includes('list_cash_reports') ||
    message.includes('create_cash_report') ||
    message.includes('update_cash_report') ||
    message.includes('delete_cash_report')
  ) {
    return `Database Supabase belum diupdate atau schema cache belum refresh pada project ${supabaseProjectRef || 'aktif'}. Jalankan file supabase/cash_reports_rpc.sql di SQL Editor project itu, tunggu beberapa detik, lalu refresh aplikasi. Jika masih sama, jalankan SQL: NOTIFY pgrst, 'reload schema';`;
  }

  return message || fallback;
}

export async function listCashReports(filters = {}) {
  const { data, error } = await supabase.rpc('list_cash_reports', {
    p_type: filters.type && filters.type !== 'all' ? filters.type : null,
    p_date_from: filters.dateFrom || null,
    p_date_to: filters.dateTo || null,
  });

  if (error) {
    throw new Error(getCashReportsServiceErrorMessage(error, 'Gagal mengambil laporan kas.'));
  }

  return Array.isArray(data) ? data : [];
}

export async function createCashReport(payload) {
  const { data, error } = await supabase.rpc('create_cash_report', {
    p_date: payload?.date || null,
    p_type: payload?.type || null,
    p_amount: Number(payload?.amount || 0),
    p_category: payload?.category || null,
    p_description: payload?.description || null,
  });

  if (error) {
    throw new Error(getCashReportsServiceErrorMessage(error, 'Gagal menambah laporan kas.'));
  }

  return normalizeRpcRow(data);
}

export async function updateCashReport(id, payload) {
  const { data, error } = await supabase.rpc('update_cash_report', {
    p_id: id || null,
    p_date: payload?.date || null,
    p_type: payload?.type || null,
    p_amount: Number(payload?.amount || 0),
    p_category: payload?.category || null,
    p_description: payload?.description || null,
  });

  if (error) {
    throw new Error(getCashReportsServiceErrorMessage(error, 'Gagal memperbarui laporan kas.'));
  }

  return normalizeRpcRow(data);
}

export async function deleteCashReport(id) {
  const { error } = await supabase.rpc('delete_cash_report', {
    p_id: id || null,
  });

  if (error) {
    throw new Error(getCashReportsServiceErrorMessage(error, 'Gagal menghapus laporan kas.'));
  }
}
