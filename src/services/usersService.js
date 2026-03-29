import { supabase } from '../lib/supabaseClient';
import { unwrapResponse } from './baseService';

export async function listProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  unwrapResponse(error, 'Gagal mengambil data user.');

  return data || [];
}

export async function updateProfile(id, payload) {
  const { data, error } = await supabase.from('profiles').update(payload).eq('id', id).select('*').single();
  unwrapResponse(error, 'Gagal memperbarui profile user.');

  return data;
}
