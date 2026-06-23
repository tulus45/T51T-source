import { createQueryString, requestJson } from './baseService';
import { getScheduleHistoryStartDate } from '../utils/schedule';

function assertScheduleDateWithinRetention(dateValue) {
  const retentionStartDate = getScheduleHistoryStartDate();

  if (dateValue && String(dateValue) < retentionStartDate) {
    throw new Error(
      `Jadwal sebelum ${retentionStartDate} tidak lagi disimpan karena sistem hanya menyimpan maksimal 5 minggu sebelumnya.`,
    );
  }
}

function assertSchedulesWithinRetention(payload) {
  const scheduleRows = Array.isArray(payload) ? payload : [payload];

  scheduleRows.forEach((schedule) => {
    assertScheduleDateWithinRetention(schedule?.date);
  });
}

function normalizeScheduleFilters(filters = {}) {
  const retentionStartDate = getScheduleHistoryStartDate();
  const normalizedFilters = { ...(filters || {}) };

  if (normalizedFilters.date && String(normalizedFilters.date) < retentionStartDate) {
    return null;
  }

  if (normalizedFilters.dateTo && String(normalizedFilters.dateTo) < retentionStartDate) {
    return null;
  }

  if (normalizedFilters.dateFrom && String(normalizedFilters.dateFrom) < retentionStartDate) {
    normalizedFilters.dateFrom = retentionStartDate;
  }

  return normalizedFilters;
}

export async function pruneExpiredSchedules({ throwOnError = true } = {}) {
  try {
    await requestJson('/api/schedules/prune', {
      method: 'POST',
    });
    return true;
  } catch (error) {
    if (throwOnError) {
      throw error;
    }

    return false;
  }
}

export async function listSchedules(filters = {}) {
  const normalizedFilters = normalizeScheduleFilters(filters);

  if (!normalizedFilters) {
    return [];
  }

  return requestJson(`/api/schedules${createQueryString({
    date: normalizedFilters.date,
    dateFrom: normalizedFilters.dateFrom,
    dateTo: normalizedFilters.dateTo,
    employeeId: normalizedFilters.employeeId,
  })}`, {
    method: 'GET',
  });
}

export async function createSchedule(payload) {
  assertSchedulesWithinRetention(payload);
  await pruneExpiredSchedules({ throwOnError: false });
  return requestJson('/api/schedules', {
    body: payload,
    method: 'POST',
  });
}

export async function updateSchedule(id, payload) {
  assertSchedulesWithinRetention(payload);
  await pruneExpiredSchedules({ throwOnError: false });
  return requestJson(`/api/schedules/${id}`, {
    body: payload,
    method: 'PUT',
  });
}

export async function upsertSchedules(payload = []) {
  if (!Array.isArray(payload) || payload.length === 0) {
    return [];
  }

  assertSchedulesWithinRetention(payload);
  await pruneExpiredSchedules({ throwOnError: false });
  return requestJson('/api/schedules/upsert', {
    body: payload,
    method: 'POST',
  });
}

export async function deleteSchedule(id) {
  return requestJson(`/api/schedules/${id}`, {
    method: 'DELETE',
  });
}

export async function deleteSchedulesByIds(ids = []) {
  const normalizedIds = Array.from(new Set((Array.isArray(ids) ? ids : []).filter(Boolean)));

  if (!normalizedIds.length) {
    return;
  }

  return requestJson('/api/schedules/delete-by-ids', {
    body: {
      ids: normalizedIds,
    },
    method: 'POST',
  });
}

export async function deleteSchedules(filters = {}) {
  return requestJson(`/api/schedules${createQueryString({
    date: filters.date,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    employeeId: filters.employeeId,
    all: filters.all ? 'true' : '',
  })}`, {
    method: 'DELETE',
  });
}

export async function bulkCreateSchedules(payload) {
  assertSchedulesWithinRetention(payload);
  await pruneExpiredSchedules({ throwOnError: false });
  return requestJson('/api/schedules/bulk', {
    body: payload,
    method: 'POST',
  });
}
