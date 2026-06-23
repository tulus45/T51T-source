import { createQueryString, requestJson } from './baseService';

export async function getSalesMonthTarget(monthStart) {
  return requestJson(`/api/sales/month-target${createQueryString({ monthStart })}`, {
    method: 'GET',
  });
}

export async function upsertSalesMonthTarget(payload) {
  return requestJson('/api/sales/month-target', {
    body: payload,
    method: 'PUT',
  });
}

export async function listDailySalesReports(filters = {}) {
  return requestJson(`/api/sales/daily${createQueryString({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  })}`, {
    method: 'GET',
  });
}

export async function upsertDailySalesReport(payload) {
  return requestJson('/api/sales/daily', {
    body: payload,
    method: 'PUT',
  });
}

export async function deleteDailySalesReport(date) {
  return requestJson(`/api/sales/daily/${date}`, {
    method: 'DELETE',
  });
}
