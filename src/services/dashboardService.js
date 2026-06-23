import { requestJson } from './baseService';

export async function getDashboardSummary() {
  return requestJson('/api/dashboard/summary', {
    method: 'GET',
  });
}
