import {
  clearStoredAuthSession,
  getStoredAuthSession,
  setStoredAuthSession,
} from '../lib/supabaseClient';
import { requestJson } from './baseService';

export async function loginWithPassword({ email, password }) {
  const data = await requestJson('/api/auth/login', {
    body: {
      email,
      password,
    },
    includeAuth: false,
    method: 'POST',
  });
  setStoredAuthSession(data);
  return data;
}

export async function logoutSession() {
  try {
    if (getStoredAuthSession()?.session?.token) {
      await requestJson('/api/auth/logout', {
        method: 'POST',
      });
    }
  } finally {
    clearStoredAuthSession();
  }
}

export async function getCurrentSession() {
  if (!getStoredAuthSession()?.session?.token) {
    return null;
  }

  const data = await requestJson('/api/auth/session', {
    method: 'GET',
  });

  if (!data?.session?.token || !data?.user || !data?.profile) {
    clearStoredAuthSession();
    return null;
  }

  setStoredAuthSession(data);
  return data;
}
