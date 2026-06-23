const AUTH_STORAGE_KEY = 'store-staff-manager-auth';

function getWindowStorage() {
  if (typeof window === 'undefined') {
    return [];
  }

  return [window.sessionStorage, window.localStorage];
}

function parseStoredAuth(value) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function getStoredAuthSession() {
  const storageList = getWindowStorage();

  for (const storage of storageList) {
    const parsed = parseStoredAuth(storage.getItem(AUTH_STORAGE_KEY));

    if (parsed?.session?.token) {
      return parsed;
    }
  }

  return null;
}

export function setStoredAuthSession(value) {
  if (!value) {
    return;
  }

  const serializedValue = JSON.stringify(value);

  getWindowStorage().forEach((storage) => {
    storage.setItem(AUTH_STORAGE_KEY, serializedValue);
  });
}

export function clearStoredAuthSession() {
  getWindowStorage().forEach((storage) => {
    storage.removeItem(AUTH_STORAGE_KEY);
  });
}

export function getAuthToken() {
  return getStoredAuthSession()?.session?.token || '';
}

export async function apiFetch(path, options = {}) {
  const { body, headers = {}, includeAuth = true, ...restOptions } = options;
  const requestHeaders = new Headers(headers);

  if (body !== undefined && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (includeAuth) {
    const token = getAuthToken();

    if (token && !requestHeaders.has('Authorization')) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(path, {
    ...restOptions,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.error || `Request gagal dengan status ${response.status}.`);
  }

  return payload;
}
