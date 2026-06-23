import { apiFetch } from '../lib/supabaseClient';

export async function requestJson(path, options = {}) {
  return apiFetch(path, options);
}

export function createQueryString(filters = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}
