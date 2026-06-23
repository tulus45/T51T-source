import { createQueryString, requestJson } from './baseService';

export async function listCashReports(filters = {}) {
  return requestJson(`/api/cash-reports${createQueryString({
    type: filters.type,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  })}`, {
    method: 'GET',
  });
}

export async function createCashReport(payload) {
  return requestJson('/api/cash-reports', {
    body: payload,
    method: 'POST',
  });
}

export async function updateCashReport(id, payload) {
  return requestJson(`/api/cash-reports/${id}`, {
    body: payload,
    method: 'PUT',
  });
}

export async function deleteCashReport(id) {
  return requestJson(`/api/cash-reports/${id}`, {
    method: 'DELETE',
  });
}
