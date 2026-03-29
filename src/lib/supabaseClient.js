import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseProjectRef = (() => {
  try {
    return new URL(supabaseUrl).hostname.split('.')[0];
  } catch {
    return '';
  }
})();
const supabaseStorageKey = `sb-${supabaseProjectRef || 'store-staff-manager'}-auth-token`;

function getAuthStorage() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    window.localStorage.removeItem(supabaseStorageKey);
  } catch {
    // Ignore cleanup failures; session auth still works via sessionStorage.
  }

  return window.sessionStorage;
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase environment variables belum diatur.');
}

export { supabaseProjectRef };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: supabaseStorageKey,
    storage: getAuthStorage(),
  },
});
