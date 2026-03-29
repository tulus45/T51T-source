import { supabase } from '../lib/supabaseClient';
import { unwrapResponse } from './baseService';

export async function loginWithPassword({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  unwrapResponse(error, 'Login gagal.');

  return data;
}

export async function logoutSession() {
  const { error } = await supabase.auth.signOut();
  unwrapResponse(error, 'Logout gagal.');
}

export async function getCurrentSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  unwrapResponse(error, 'Gagal mengambil session.');

  return session;
}

export async function getProfileByUserId(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  unwrapResponse(error, 'Profile user tidak ditemukan.');

  return data;
}
