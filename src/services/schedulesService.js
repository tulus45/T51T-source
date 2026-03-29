import { supabase } from '../lib/supabaseClient';
import { unwrapResponse } from './baseService';

const scheduleSelect = '*, employee:employees(id, name, position, photo_url)';

export async function listSchedules(filters = {}) {
  let query = supabase
    .from('schedules')
    .select(scheduleSelect)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: false });

  if (filters.date) {
    query = query.eq('date', filters.date);
  }

  if (filters.dateFrom) {
    query = query.gte('date', filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte('date', filters.dateTo);
  }

  if (filters.employeeId && filters.employeeId !== 'all') {
    query = query.eq('employee_id', filters.employeeId);
  }

  const { data, error } = await query;
  unwrapResponse(error, 'Gagal mengambil jadwal shift.');

  return data || [];
}

export async function createSchedule(payload) {
  const { data, error } = await supabase.from('schedules').insert(payload).select(scheduleSelect).single();
  unwrapResponse(error, 'Gagal menambah jadwal shift.');

  return data;
}

export async function updateSchedule(id, payload) {
  const { data, error } = await supabase.from('schedules').update(payload).eq('id', id).select(scheduleSelect).single();
  unwrapResponse(error, 'Gagal memperbarui jadwal shift.');

  return data;
}

export async function upsertSchedules(payload = []) {
  if (!Array.isArray(payload) || payload.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('schedules')
    .upsert(payload, { onConflict: 'date,employee_id' })
    .select(scheduleSelect);
  unwrapResponse(error, 'Gagal menyimpan perubahan jadwal shift.');

  return data || [];
}

export async function deleteSchedule(id) {
  const { error } = await supabase.from('schedules').delete().eq('id', id);
  unwrapResponse(error, 'Gagal menghapus jadwal shift.');
}

export async function deleteSchedulesByIds(ids = []) {
  const normalizedIds = Array.from(new Set((Array.isArray(ids) ? ids : []).filter(Boolean)));

  if (!normalizedIds.length) {
    return;
  }

  const { error } = await supabase.from('schedules').delete().in('id', normalizedIds);
  unwrapResponse(error, 'Gagal menghapus jadwal shift lama.');
}

export async function deleteSchedules(filters = {}) {
  let query = supabase.from('schedules').delete();

  if (filters.date) {
    query = query.eq('date', filters.date);
  }

  if (filters.dateFrom) {
    query = query.gte('date', filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte('date', filters.dateTo);
  }

  if (filters.employeeId && filters.employeeId !== 'all') {
    query = query.eq('employee_id', filters.employeeId);
  }

  if (filters.all) {
    query = query.not('id', 'is', null);
  }

  const { error } = await query;
  unwrapResponse(error, 'Gagal mereset jadwal shift.');
}

export async function bulkCreateSchedules(payload) {
  const { data, error } = await supabase.from('schedules').insert(payload).select(scheduleSelect);
  unwrapResponse(error, 'Gagal generate jadwal shift.');

  return data || [];
}
