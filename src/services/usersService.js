import { requestJson } from './baseService';

export async function listProfiles() {
  return requestJson('/api/users', {
    method: 'GET',
  });
}

export async function updateProfile(id, payload) {
  return requestJson(`/api/users/${id}`, {
    body: payload,
    method: 'PATCH',
  });
}
