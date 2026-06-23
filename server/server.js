import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_OFF_DAY_WEEKDAYS,
  ROLE_VALUES,
  SESSION_DURATION_DAYS,
  addDaysIso,
  all,
  createPasswordHash,
  createSessionToken,
  get,
  initializeDatabase,
  mapCashReportRow,
  mapEmployeeRow,
  mapProfileRow,
  mapSalesDailyReportRow,
  mapSalesMonthTargetRow,
  mapScheduleRow,
  nowIso,
  run,
  uploadsDir,
  verifyPasswordHash,
  withTransaction,
} from './db.js';

const app = express();
const PORT = Number(process.env.PORT || 4718);
const ROLE_CAN_MANAGE = {
  employees: ['super_admin', 'admin'],
  cash_reports: ['super_admin', 'admin'],
  sales_reports: ['super_admin', 'admin'],
  schedules: ['super_admin', 'admin'],
  users: ['super_admin'],
};

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function asyncHandler(handler) {
  return async (request, response, next) => {
    try {
      await handler(request, response);
    } catch (error) {
      next(error);
    }
  };
}

function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    throw createHttpError(400, `Tanggal tidak valid: ${value}`);
  }

  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));

  if (parsed.toISOString().slice(0, 10) !== value) {
    throw createHttpError(400, `Tanggal tidak valid: ${value}`);
  }

  return parsed;
}

function shiftDateKeyByDays(dateKey, amount) {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function getWeekStartDateKey(dateKey) {
  const date = parseDateKey(dateKey);
  const dayIndex = date.getUTCDay();
  const offset = dayIndex === 0 ? -6 : 1 - dayIndex;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function getScheduleHistoryStartDate(referenceDate = toDateKey()) {
  return shiftDateKeyByDays(getWeekStartDateKey(referenceDate), -35);
}

function getMonthStartDateKey(dateKey = toDateKey()) {
  return `${String(dateKey).slice(0, 7)}-01`;
}

function getPreviousMonthStartDateKey(monthStart) {
  const date = parseDateKey(monthStart);
  date.setUTCMonth(date.getUTCMonth() - 1);
  date.setUTCDate(1);
  return date.toISOString().slice(0, 10);
}

function getDaysInMonth(dateKey) {
  const date = parseDateKey(dateKey);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

function getMonthEndDateKey(monthStart) {
  const date = parseDateKey(monthStart);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

function getPreviousComparableDate(currentDateKey) {
  if (!currentDateKey) {
    return null;
  }

  const currentDate = parseDateKey(currentDateKey);
  const previousMonthDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() - 1, 1));
  const previousMonthLastDay = new Date(Date.UTC(previousMonthDate.getUTCFullYear(), previousMonthDate.getUTCMonth() + 1, 0)).getUTCDate();
  const comparableDay = Math.min(currentDate.getUTCDate(), previousMonthLastDay);
  return new Date(Date.UTC(previousMonthDate.getUTCFullYear(), previousMonthDate.getUTCMonth(), comparableDay))
    .toISOString()
    .slice(0, 10);
}

function formatDateLabel(value) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

function formatMonthLabel(value) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

function toNumber(value = 0) {
  return Number(value || 0);
}

function toInteger(value = 0) {
  return Number.parseInt(value || 0, 10) || 0;
}

function toBooleanInt(value) {
  return value ? 1 : 0;
}

function parseOffDayWeekdays(values) {
  const list = Array.isArray(values) ? values : DEFAULT_OFF_DAY_WEEKDAYS;
  const uniqueValues = Array.from(new Set(list.map((value) => Number(value)))).filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  return uniqueValues.length ? uniqueValues : [...DEFAULT_OFF_DAY_WEEKDAYS];
}

function normalizeProfileRole(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();

  if (!ROLE_VALUES.includes(normalizedValue)) {
    throw createHttpError(400, 'Role user tidak valid.');
  }

  return normalizedValue;
}

function normalizeCashType(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();

  if (!['income', 'expense'].includes(normalizedValue)) {
    throw createHttpError(400, 'Jenis transaksi kas tidak valid.');
  }

  return normalizedValue;
}

function normalizeScheduleShiftType(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();

  if (!['pagi', 'siang', 'malam', 'libur'].includes(normalizedValue)) {
    throw createHttpError(400, 'Shift jadwal tidak valid.');
  }

  return normalizedValue;
}

function normalizeEmployeePayload(payload = {}) {
  if (!String(payload.name || '').trim()) {
    throw createHttpError(400, 'Nama pegawai wajib diisi.');
  }

  if (!String(payload.position || '').trim()) {
    throw createHttpError(400, 'Jabatan pegawai wajib diisi.');
  }

  return {
    name: String(payload.name).trim(),
    position: String(payload.position).trim(),
    phone: payload.phone ? String(payload.phone).trim() : null,
    email: payload.email ? String(payload.email).trim().toLowerCase() : null,
    gender: payload.gender ? String(payload.gender).trim().toLowerCase() : null,
    kasir: toBooleanInt(Boolean(payload.kasir)),
    pimpinan_shift: toBooleanInt(Boolean(payload.pimpinan_shift)),
    shift_pagi: toBooleanInt(Boolean(payload.shift_pagi)),
    shift_siang: toBooleanInt(Boolean(payload.shift_siang)),
    off_day_mode: String(payload.off_day_mode || 'all').trim().toLowerCase() === 'custom' ? 'custom' : 'all',
    off_day_weekdays: JSON.stringify(parseOffDayWeekdays(payload.off_day_weekdays)),
    holiday_mandatory_off: toBooleanInt(Boolean(payload.holiday_mandatory_off)),
    status: String(payload.status || 'aktif').trim().toLowerCase() || 'aktif',
    hierarchy_order: toInteger(payload.hierarchy_order || 1),
    photo_url: payload.photo_url ? String(payload.photo_url).trim() : null,
    created_by: payload.created_by ? String(payload.created_by) : null,
  };
}

function normalizeCashReportPayload(payload = {}) {
  if (!payload.date) {
    throw createHttpError(400, 'Tanggal transaksi kas wajib diisi.');
  }

  if (!String(payload.category || '').trim()) {
    throw createHttpError(400, 'Kategori transaksi kas wajib diisi.');
  }

  return {
    date: parseDateKey(payload.date).toISOString().slice(0, 10),
    type: normalizeCashType(payload.type),
    amount: toNumber(payload.amount || 0),
    category: String(payload.category).trim(),
    description: payload.description ? String(payload.description).trim() : null,
  };
}

function normalizeSchedulePayload(payload = {}, fallbackCreatedBy = null) {
  if (!payload.date) {
    throw createHttpError(400, 'Tanggal jadwal wajib diisi.');
  }

  if (!payload.employee_id) {
    throw createHttpError(400, 'Pegawai untuk jadwal wajib dipilih.');
  }

  const shiftType = normalizeScheduleShiftType(payload.shift_type);
  const dateValue = parseDateKey(payload.date).toISOString().slice(0, 10);
  const startTime = shiftType === 'libur' ? null : payload.start_time ? String(payload.start_time).slice(0, 5) : null;
  const endTime = shiftType === 'libur' ? null : payload.end_time ? String(payload.end_time).slice(0, 5) : null;

  if (shiftType !== 'libur' && (!startTime || !endTime)) {
    throw createHttpError(400, 'Jam mulai dan selesai wajib diisi untuk jadwal kerja.');
  }

  if (shiftType !== 'libur' && startTime >= endTime) {
    throw createHttpError(400, 'Jam selesai harus lebih besar dari jam mulai.');
  }

  return {
    date: dateValue,
    employee_id: String(payload.employee_id),
    shift_type: shiftType,
    start_time: startTime,
    end_time: endTime,
    notes: payload.notes ? String(payload.notes).trim() : null,
    created_by: payload.created_by ? String(payload.created_by) : fallbackCreatedBy,
  };
}

function normalizeSalesMonthTargetPayload(payload = {}) {
  if (!payload.month_start) {
    throw createHttpError(400, 'Periode target sales wajib diisi.');
  }

  return {
    month_start: parseDateKey(payload.month_start).toISOString().slice(0, 10),
    target_amount: toNumber(payload.target_amount || 0),
  };
}

function normalizeSalesDailyPayload(payload = {}) {
  if (!payload.date) {
    throw createHttpError(400, 'Tanggal laporan sales wajib diisi.');
  }

  return {
    date: parseDateKey(payload.date).toISOString().slice(0, 10),
    sales_amount: toNumber(payload.sales_amount || 0),
    receipt_count: toInteger(payload.receipt_count || 0),
  };
}

function normalizeUserEmail(value, { required = false } = {}) {
  const normalizedValue = String(value || '').trim().toLowerCase();

  if (!normalizedValue) {
    if (required) {
      throw createHttpError(400, 'Email user wajib diisi.');
    }

    return '';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue)) {
    throw createHttpError(400, 'Format email user tidak valid.');
  }

  return normalizedValue;
}

function normalizeUserPassword(value, { required = false } = {}) {
  const normalizedValue = String(value || '');

  if (!normalizedValue) {
    if (required) {
      throw createHttpError(400, 'Password user wajib diisi.');
    }

    return '';
  }

  if (normalizedValue.length < 6) {
    throw createHttpError(400, 'Password user minimal 6 karakter.');
  }

  return normalizedValue;
}

function normalizeUserFullName(value, fallbackEmail = '') {
  const normalizedValue = String(value || '').trim();

  if (normalizedValue) {
    return normalizedValue;
  }

  const emailPrefix = String(fallbackEmail || '').split('@')[0]?.trim();
  return emailPrefix || 'Tanpa Nama';
}

function normalizeCreateUserPayload(payload = {}) {
  const email = normalizeUserEmail(payload.email, { required: true });

  return {
    email,
    password: normalizeUserPassword(payload.password, { required: true }),
    full_name: normalizeUserFullName(payload.full_name, email),
    role: normalizeProfileRole(payload.role || 'viewer'),
    is_active: toBooleanInt(payload.is_active !== undefined ? Boolean(payload.is_active) : true),
  };
}

function normalizeUpdateUserPayload(payload = {}, existingUser = null) {
  const normalizedPayload = {};
  const nextEmail = payload.email !== undefined
    ? normalizeUserEmail(payload.email, { required: true })
    : existingUser?.email || '';

  if (payload.full_name !== undefined) {
    normalizedPayload.full_name = normalizeUserFullName(payload.full_name, nextEmail);
  }

  if (payload.email !== undefined) {
    normalizedPayload.email = nextEmail;
  }

  if (payload.password !== undefined) {
    const normalizedPassword = normalizeUserPassword(payload.password);

    if (normalizedPassword) {
      normalizedPayload.password = normalizedPassword;
    }
  }

  if (payload.role !== undefined) {
    normalizedPayload.role = normalizeProfileRole(payload.role);
  }

  if (payload.is_active !== undefined) {
    normalizedPayload.is_active = toBooleanInt(Boolean(payload.is_active));
  }

  return normalizedPayload;
}

function buildQueryFilters(baseSql, filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.position && filters.position !== 'all') {
    conditions.push('position = ?');
    params.push(filters.position);
  }

  if (filters.type && filters.type !== 'all') {
    conditions.push('type = ?');
    params.push(filters.type);
  }

  if (filters.date) {
    conditions.push('date = ?');
    params.push(filters.date);
  }

  if (filters.dateFrom) {
    conditions.push('date >= ?');
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    conditions.push('date <= ?');
    params.push(filters.dateTo);
  }

  if (filters.employeeId && filters.employeeId !== 'all') {
    conditions.push('employee_id = ?');
    params.push(filters.employeeId);
  }

  const sql = conditions.length ? `${baseSql} where ${conditions.join(' and ')}` : baseSql;
  return { sql, params };
}

function buildUpdateClause(payload, allowedKeys) {
  const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
  const filteredEntries = entries.filter(([key]) => allowedKeys.includes(key));

  if (!filteredEntries.length) {
    throw createHttpError(400, 'Tidak ada perubahan yang bisa disimpan.');
  }

  return {
    clause: filteredEntries.map(([key]) => `${key} = ?`).join(', '),
    params: filteredEntries.map(([, value]) => value),
  };
}

async function getAuthSnapshotByToken(token) {
  if (!token) {
    return null;
  }

  const row = await get(
    `
      select
        s.id as session_id,
        s.token,
        s.created_at as session_created_at,
        s.expires_at,
        u.id as user_id,
        u.email,
        p.full_name,
        p.role,
        p.is_active,
        p.created_at as profile_created_at
      from sessions s
      join users u on u.id = s.user_id
      join profiles p on p.id = u.id
      where s.token = ?
    `,
    [token],
  );

  if (!row) {
    return null;
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await run('delete from sessions where id = ?', [row.session_id]);
    return null;
  }

  return {
    session: {
      id: row.session_id,
      token: row.token,
      created_at: row.session_created_at,
      expires_at: row.expires_at,
      user: {
        id: row.user_id,
        email: row.email,
      },
    },
    user: {
      id: row.user_id,
      email: row.email,
    },
    profile: mapProfileRow({
      id: row.user_id,
      email: row.email,
      full_name: row.full_name,
      role: row.role,
      is_active: row.is_active,
      created_at: row.profile_created_at,
    }),
  };
}

function getTokenFromRequest(request) {
  const headerValue = request.headers.authorization || '';

  if (!headerValue.startsWith('Bearer ')) {
    return '';
  }

  return headerValue.slice('Bearer '.length).trim();
}

async function requireAuth(request, _response, next) {
  try {
    const token = getTokenFromRequest(request);

    if (!token) {
      throw createHttpError(401, 'Session tidak ditemukan. Silakan login kembali.');
    }

    const snapshot = await getAuthSnapshotByToken(token);

    if (!snapshot) {
      throw createHttpError(401, 'Session sudah tidak berlaku. Silakan login kembali.');
    }

    if (!snapshot.profile?.is_active) {
      throw createHttpError(403, 'Akun Anda sedang nonaktif. Hubungi super admin.');
    }

    request.auth = snapshot;
    next();
  } catch (error) {
    next(error);
  }
}

function requireRoles(roles = []) {
  return (request, _response, next) => {
    const role = request.auth?.profile?.role;

    if (!roles.includes(role)) {
      next(createHttpError(403, 'Anda tidak memiliki izin untuk aksi ini.'));
      return;
    }

    next();
  };
}

async function listEmployeesWithRules(filters = {}) {
  const { sql, params } = buildQueryFilters(
    `
      select
        id,
        name,
        position,
        phone,
        email,
        gender,
        kasir,
        pimpinan_shift,
        shift_pagi,
        shift_siang,
        off_day_mode,
        off_day_weekdays,
        holiday_mandatory_off,
        status,
        hierarchy_order,
        photo_url,
        created_at,
        created_by
      from employees
    `,
    filters,
  );

  const [employeeRows, separationRows] = await Promise.all([
    all(`${sql} order by hierarchy_order asc, name asc`, params),
    all('select employee_id, restricted_employee_id from employee_shift_separation_rules'),
  ]);
  const employees = employeeRows.map(mapEmployeeRow);
  const employeeNameById = new Map(employees.map((employee) => [String(employee.id), employee.name]));
  const separatedIdsByEmployeeId = new Map(employees.map((employee) => [String(employee.id), []]));

  separationRows.forEach((rule) => {
    const leftId = String(rule.employee_id);
    const rightId = String(rule.restricted_employee_id);

    if (!separatedIdsByEmployeeId.has(leftId) || !separatedIdsByEmployeeId.has(rightId)) {
      return;
    }

    separatedIdsByEmployeeId.get(leftId).push(rightId);
    separatedIdsByEmployeeId.get(rightId).push(leftId);
  });

  return employees.map((employee) => {
    const separatedEmployeeIds = Array.from(new Set(separatedIdsByEmployeeId.get(String(employee.id)) || []));

    return {
      ...employee,
      separated_employee_ids: separatedEmployeeIds,
      separated_employee_names: separatedEmployeeIds.map((employeeId) => employeeNameById.get(employeeId)).filter(Boolean),
    };
  });
}

async function getScheduleRows(filters = {}) {
  const { sql, params } = buildQueryFilters(
    `
      select
        s.id,
        s.date,
        s.employee_id,
        s.shift_type,
        s.start_time,
        s.end_time,
        s.notes,
        s.created_at,
        s.created_by,
        e.name as employee_name,
        e.position as employee_position,
        e.photo_url as employee_photo_url
      from schedules s
      join employees e on e.id = s.employee_id
    `,
    filters,
  );

  const rows = await all(
    `${sql} order by s.date asc, case when s.start_time is null then 1 else 0 end asc, s.start_time asc, e.name asc`,
    params,
  );
  return rows.map(mapScheduleRow);
}

async function getCashReportById(id) {
  const row = await get('select * from cash_reports where id = ?', [id]);
  return mapCashReportRow(row);
}

async function getEmployeeById(id) {
  const row = await get('select * from employees where id = ?', [id]);
  return mapEmployeeRow(row);
}

async function getScheduleById(id) {
  const rows = await getScheduleRows({ });
  return rows.find((row) => row.id === id) || null;
}

async function getUserById(id) {
  const row = await get(
    `
      select p.id, p.full_name, p.role, p.is_active, p.created_at, u.email
      from profiles p
      join users u on u.id = p.id
      where p.id = ?
    `,
    [id],
  );

  return row ? mapProfileRow(row) : null;
}

async function replaceEmployeeSeparationRules(employeeId, restrictedEmployeeIds = [], createdBy = null) {
  const normalizedEmployeeId = String(employeeId || '');

  if (!normalizedEmployeeId) {
    throw createHttpError(400, 'Pegawai untuk rule pisah shift tidak valid.');
  }

  const normalizedRestrictedIds = Array.from(
    new Set((Array.isArray(restrictedEmployeeIds) ? restrictedEmployeeIds : []).map((value) => String(value || '')).filter(Boolean)),
  ).filter((value) => value !== normalizedEmployeeId);
  const targetPairs = normalizedRestrictedIds
    .map((restrictedEmployeeId) =>
      normalizedEmployeeId < restrictedEmployeeId
        ? [normalizedEmployeeId, restrictedEmployeeId]
        : [restrictedEmployeeId, normalizedEmployeeId],
    )
    .map((pair) => pair.join(':'));
  const targetPairSet = new Set(targetPairs);

  await withTransaction(async () => {
    const existingRules = await all(
      `
        select id, employee_id, restricted_employee_id
        from employee_shift_separation_rules
        where employee_id = ? or restricted_employee_id = ?
      `,
      [normalizedEmployeeId, normalizedEmployeeId],
    );

    const existingByPair = new Map(
      existingRules.map((rule) => {
        const leftId = String(rule.employee_id);
        const rightId = String(rule.restricted_employee_id);
        return [[leftId, rightId].sort().join(':'), rule];
      }),
    );

    const deleteIds = existingRules
      .filter((rule) => {
        const pairKey = [String(rule.employee_id), String(rule.restricted_employee_id)].sort().join(':');
        return !targetPairSet.has(pairKey);
      })
      .map((rule) => rule.id);

    if (deleteIds.length) {
      const placeholders = deleteIds.map(() => '?').join(', ');
      await run(`delete from employee_shift_separation_rules where id in (${placeholders})`, deleteIds);
    }

    for (const pairKey of targetPairSet) {
      if (existingByPair.has(pairKey)) {
        continue;
      }

      const [leftId, rightId] = pairKey.split(':');
      await run(
        `
          insert into employee_shift_separation_rules (id, employee_id, restricted_employee_id, created_at, created_by)
          values (?, ?, ?, ?, ?)
        `,
        [randomUUID(), leftId, rightId, nowIso(), createdBy],
      );
    }
  });
}

function buildAuthResponse(snapshot) {
  return snapshot || {
    session: null,
    user: null,
    profile: null,
  };
}

function buildProjectionData({ latestInputDate, previousComparableDate, currentMtdSales, previousMtdSales, currentMtdReceipts, previousMtdReceipts, dayCountInMonth }) {
  const currentInputDay = latestInputDate ? Number(latestInputDate.slice(8, 10)) : 0;
  const previousInputDay = previousComparableDate ? Number(previousComparableDate.slice(8, 10)) : 0;
  const currentSpd = currentInputDay > 0 ? currentMtdSales / currentInputDay : 0;
  const previousSpd = previousInputDay > 0 ? previousMtdSales / previousInputDay : 0;
  const currentApc = currentMtdReceipts > 0 ? currentMtdSales / currentMtdReceipts : 0;
  const previousApc = previousMtdReceipts > 0 ? previousMtdSales / previousMtdReceipts : 0;

  return {
    latestInputDate,
    latestInputDateLabel: formatDateLabel(latestInputDate),
    monthLabel: formatMonthLabel(latestInputDate || toDateKey()),
    previousComparableDate,
    previousComparableDateLabel: formatDateLabel(previousComparableDate),
    spd: currentSpd,
    spdLm: previousSpd,
    spdDelta: currentSpd - previousSpd,
    dayCountInMonth,
    projectionValue: currentSpd * dayCountInMonth,
    currentReceiptCount: currentMtdReceipts,
    previousReceiptCount: previousMtdReceipts,
    receiptDelta: currentMtdReceipts - previousMtdReceipts,
    currentApc,
    previousApc,
    apcDelta: currentApc - previousApc,
  };
}

function buildProjectionAnalysis({ salesDelta, receiptDelta, apcDelta }) {
  const analysisPoints = [];
  const recommendationPoints = [];
  let driverLabel = 'Kondisi sales stabil';
  let headline = 'Data proyeksi sales sudah tersedia untuk dibaca dari backend lokal.';

  if (salesDelta < 0) {
    driverLabel = 'SPD turun vs bulan lalu';
    headline = 'Rata-rata sales harian masih di bawah ritme bulan lalu.';
    analysisPoints.push('SPD rata-rata berjalan lebih rendah dibanding pembanding bulan lalu pada jumlah hari yang sama.');
    recommendationPoints.push('Fokuskan promosi harian dan monitoring item dengan kontribusi sales terbesar.');
  } else if (salesDelta > 0) {
    driverLabel = 'SPD naik vs bulan lalu';
    analysisPoints.push('SPD rata-rata berjalan sudah lebih tinggi dibanding pembanding bulan lalu.');
    recommendationPoints.push('Pertahankan ritme penjualan dan jaga konsistensi jam ramai.');
  }

  if (receiptDelta < 0) {
    analysisPoints.push('Jumlah struk berjalan masih lebih rendah dari pembanding, sehingga traffic transaksi perlu digenjot.');
    recommendationPoints.push('Dorong aktivitas frontliner untuk menaikkan jumlah transaksi masuk.');
  } else if (receiptDelta > 0) {
    analysisPoints.push('Jumlah struk berjalan sudah lebih tinggi dari pembanding, tanda traffic transaksi membaik.');
  }

  if (apcDelta < 0) {
    analysisPoints.push('APC berjalan menurun, artinya nilai belanja per transaksi masih bisa ditingkatkan.');
    recommendationPoints.push('Dorong upselling dan bundling agar APC kembali naik.');
  } else if (apcDelta > 0) {
    analysisPoints.push('APC berjalan membaik sehingga kualitas tiap transaksi ikut naik.');
  }

  if (!analysisPoints.length) {
    analysisPoints.push('Belum ada cukup perbedaan signifikan untuk menarik insight khusus dari pembanding.');
  }

  if (!recommendationPoints.length) {
    recommendationPoints.push('Lanjutkan input harian secara konsisten agar analisis proyeksi tetap akurat.');
  }

  return {
    headline,
    driverLabel,
    analysisPoints,
    recommendationPoints,
  };
}

app.use(express.json({ limit: '10mb' }));
app.use('/api/uploads', express.static(uploadsDir));

app.post(
  '/api/auth/login',
  asyncHandler(async (request, response) => {
    const email = String(request.body?.email || '').trim().toLowerCase();
    const password = String(request.body?.password || '');

    if (!email || !password) {
      throw createHttpError(400, 'Email dan password wajib diisi.');
    }

    const userRow = await get(
      `
        select
          u.id,
          u.email,
          u.password_hash,
          p.full_name,
          p.role,
          p.is_active,
          p.created_at
        from users u
        join profiles p on p.id = u.id
        where u.email = ?
      `,
      [email],
    );

    if (!userRow || !verifyPasswordHash(password, userRow.password_hash)) {
      throw createHttpError(401, 'Email atau password salah.');
    }

    if (!Boolean(userRow.is_active)) {
      throw createHttpError(403, 'Akun Anda sedang nonaktif. Hubungi super admin.');
    }

    const token = createSessionToken();
    const sessionId = randomUUID();
    const createdAt = nowIso();
    const expiresAt = addDaysIso(createdAt, SESSION_DURATION_DAYS);

    await run(
      `
        insert into sessions (id, token, user_id, created_at, expires_at)
        values (?, ?, ?, ?, ?)
      `,
      [sessionId, token, userRow.id, createdAt, expiresAt],
    );

    const snapshot = await getAuthSnapshotByToken(token);
    response.json(buildAuthResponse(snapshot));
  }),
);

app.post(
  '/api/auth/logout',
  asyncHandler(async (request, response) => {
    const token = getTokenFromRequest(request);

    if (token) {
      await run('delete from sessions where token = ?', [token]);
    }

    response.json({ success: true });
  }),
);

app.get(
  '/api/auth/session',
  asyncHandler(async (request, response) => {
    const token = getTokenFromRequest(request);

    if (!token) {
      response.json(buildAuthResponse(null));
      return;
    }

    const snapshot = await getAuthSnapshotByToken(token);
    response.json(buildAuthResponse(snapshot));
  }),
);

app.get(
  '/api/dashboard/summary',
  requireAuth,
  asyncHandler(async (_request, response) => {
    const currentMonthStart = getMonthStartDateKey();
    const currentMonthEnd = getMonthEndDateKey(currentMonthStart);
    const previousMonthStart = getPreviousMonthStartDateKey(currentMonthStart);
    const currentMonthTargetRow = await get('select * from sales_month_targets where month_start = ?', [currentMonthStart]);
    const currentMonthReports = (await all('select * from sales_daily_reports where date >= ? and date <= ? order by date asc', [currentMonthStart, currentMonthEnd])).map(
      mapSalesDailyReportRow,
    );
    const latestInputDate = currentMonthReports.length ? currentMonthReports[currentMonthReports.length - 1].date : null;
    const previousComparableDate = getPreviousComparableDate(latestInputDate);
    const previousMonthReports = previousComparableDate
      ? (await all('select * from sales_daily_reports where date >= ? and date <= ? order by date asc', [previousMonthStart, previousComparableDate])).map(
          mapSalesDailyReportRow,
        )
      : [];
    const [employeeCountRow, cashSummaryRow, todayScheduleRows] = await Promise.all([
      get("select count(*) as total from employees where status = 'aktif'"),
      get(
        `
          select
            sum(case when type = 'income' then amount else 0 end) as total_income,
            sum(case when type = 'expense' then amount else 0 end) as total_expense
          from cash_reports
        `,
      ),
      getScheduleRows({ date: toDateKey() }),
    ]);
    const dayCountInMonth = getDaysInMonth(currentMonthStart);
    const currentMtdSales = currentMonthReports.reduce((sum, row) => sum + Number(row.sales_amount || 0), 0);
    const currentMtdReceipts = currentMonthReports.reduce((sum, row) => sum + Number(row.receipt_count || 0), 0);
    const previousMtdSales = previousMonthReports.reduce((sum, row) => sum + Number(row.sales_amount || 0), 0);
    const previousMtdReceipts = previousMonthReports.reduce((sum, row) => sum + Number(row.receipt_count || 0), 0);
    const currentTargetAmount = Number(currentMonthTargetRow?.target_amount || 0);
    const projection = buildProjectionData({
      latestInputDate,
      previousComparableDate,
      currentMtdSales,
      previousMtdSales,
      currentMtdReceipts,
      previousMtdReceipts,
      dayCountInMonth,
    });
    const morning = [];
    const afternoon = [];
    const off = [];

    todayScheduleRows.forEach((schedule) => {
      const item = {
        id: schedule.id,
        employeeName: schedule.employee?.name || 'Pegawai',
        employeePosition: schedule.employee?.position || '-',
        photoUrl: schedule.employee?.photo_url || null,
        shiftType: schedule.shift_type,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
      };

      if (schedule.shift_type === 'pagi') {
        morning.push(item);
        return;
      }

      if (schedule.shift_type === 'libur') {
        off.push(item);
        return;
      }

      afternoon.push(item);
    });

    response.json({
      totalEmployees: Number(employeeCountRow?.total || 0),
      totalIncome: Number(cashSummaryRow?.total_income || 0),
      totalExpense: Number(cashSummaryRow?.total_expense || 0),
      balance: Number(cashSummaryRow?.total_income || 0) - Number(cashSummaryRow?.total_expense || 0),
      salesSummary: {
        monthStart: currentMonthStart,
        monthLabel: formatMonthLabel(currentMonthStart),
        targetAmount: currentTargetAmount,
        totalSales: currentMtdSales,
        receiptCount: currentMtdReceipts,
        monthlyApc: currentMtdReceipts > 0 ? Math.round((currentMtdSales / currentMtdReceipts) * 100) / 100 : 0,
        remainingTarget: Math.max(currentTargetAmount - currentMtdSales, 0),
      },
      projections: {
        salesProjection: projection,
        receiptImpactProjection: projection,
        apcImpactProjection: projection,
      },
      mtdComparison: {
        latestInputDate,
        latestInputDateLabel: formatDateLabel(latestInputDate),
        previousComparableDate,
        previousComparableDateLabel: formatDateLabel(previousComparableDate),
        currentMtdSales,
        previousMtdSales,
        currentMtdReceipts,
        previousMtdReceipts,
        currentMtdApc: currentMtdReceipts > 0 ? Math.round((currentMtdSales / currentMtdReceipts) * 100) / 100 : 0,
        previousMtdApc: previousMtdReceipts > 0 ? Math.round((previousMtdSales / previousMtdReceipts) * 100) / 100 : 0,
      },
      projectionAnalysis: buildProjectionAnalysis({
        salesDelta: projection.spdDelta,
        receiptDelta: projection.receiptDelta,
        apcDelta: projection.apcDelta,
      }),
      todaySchedules: {
        date: toDateKey(),
        dateLabel: formatDateLabel(toDateKey()),
        morning,
        afternoon,
        off,
      },
    });
  }),
);

app.get(
  '/api/cash-reports',
  requireAuth,
  asyncHandler(async (request, response) => {
    const { sql, params } = buildQueryFilters('select * from cash_reports', {
      type: request.query.type,
      dateFrom: request.query.dateFrom,
      dateTo: request.query.dateTo,
    });
    const rows = await all(`${sql} order by date desc, created_at desc`, params);
    response.json(rows.map(mapCashReportRow));
  }),
);

app.post(
  '/api/cash-reports',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.cash_reports),
  asyncHandler(async (request, response) => {
    const payload = normalizeCashReportPayload(request.body);
    const id = randomUUID();
    await run(
      `
        insert into cash_reports (id, date, type, amount, category, description, created_at, created_by)
        values (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [id, payload.date, payload.type, payload.amount, payload.category, payload.description, nowIso(), request.auth.user.id],
    );
    response.status(201).json(await getCashReportById(id));
  }),
);

app.put(
  '/api/cash-reports/:id',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.cash_reports),
  asyncHandler(async (request, response) => {
    const existingRow = await getCashReportById(request.params.id);

    if (!existingRow) {
      throw createHttpError(404, 'Laporan kas tidak ditemukan.');
    }

    const payload = normalizeCashReportPayload(request.body);
    await run(
      `
        update cash_reports
        set date = ?, type = ?, amount = ?, category = ?, description = ?
        where id = ?
      `,
      [payload.date, payload.type, payload.amount, payload.category, payload.description, request.params.id],
    );
    response.json(await getCashReportById(request.params.id));
  }),
);

app.delete(
  '/api/cash-reports/:id',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.cash_reports),
  asyncHandler(async (request, response) => {
    await run('delete from cash_reports where id = ?', [request.params.id]);
    response.json({ success: true });
  }),
);

app.get(
  '/api/users',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.users),
  asyncHandler(async (_request, response) => {
    const rows = await all(
      `
        select p.id, p.full_name, p.role, p.is_active, p.created_at, u.email
        from profiles p
        join users u on u.id = p.id
        order by p.created_at desc
      `,
    );
    response.json(rows.map(mapProfileRow));
  }),
);

app.post(
  '/api/users',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.users),
  asyncHandler(async (request, response) => {
    const payload = normalizeCreateUserPayload(request.body);
    const existingEmailOwner = await get('select id from users where email = ?', [payload.email]);

    if (existingEmailOwner) {
      throw createHttpError(400, 'Email user sudah digunakan.');
    }

    const userId = randomUUID();
    const createdAt = nowIso();

    await withTransaction(async () => {
      await run(
        'insert into users (id, email, password_hash, created_at) values (?, ?, ?, ?)',
        [userId, payload.email, createPasswordHash(payload.password), createdAt],
      );
      await run(
        'insert into profiles (id, full_name, role, is_active, created_at) values (?, ?, ?, ?, ?)',
        [userId, payload.full_name, payload.role, payload.is_active, createdAt],
      );
    });

    response.status(201).json(await getUserById(userId));
  }),
);

app.patch(
  '/api/users/:id',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.users),
  asyncHandler(async (request, response) => {
    const existingUser = await getUserById(request.params.id);

    if (!existingUser) {
      throw createHttpError(404, 'User tidak ditemukan.');
    }

    const payload = normalizeUpdateUserPayload(request.body, existingUser);

    if (request.params.id === request.auth.user.id && (payload.role !== undefined || payload.is_active !== undefined)) {
      throw createHttpError(400, 'Role atau status akun sendiri tidak bisa diubah dari halaman ini.');
    }

    if (!Object.keys(payload).length) {
      throw createHttpError(400, 'Tidak ada perubahan yang bisa disimpan.');
    }

    if (payload.email !== undefined) {
      const existingEmailOwner = await get('select id from users where email = ?', [payload.email]);

      if (existingEmailOwner && existingEmailOwner.id !== request.params.id) {
        throw createHttpError(400, 'Email user sudah digunakan.');
      }
    }

    await withTransaction(async () => {
      const accountPayload = {};

      if (payload.email !== undefined) {
        accountPayload.email = payload.email;
      }

      if (payload.password !== undefined) {
        accountPayload.password_hash = createPasswordHash(payload.password);
      }

      if (Object.keys(accountPayload).length) {
        const { clause, params } = buildUpdateClause(accountPayload, ['email', 'password_hash']);
        await run(`update users set ${clause} where id = ?`, [...params, request.params.id]);
      }

      const profilePayload = {};

      if (payload.full_name !== undefined) {
        profilePayload.full_name = payload.full_name;
      }

      if (payload.role !== undefined) {
        profilePayload.role = payload.role;
      }

      if (payload.is_active !== undefined) {
        profilePayload.is_active = payload.is_active;
      }

      if (Object.keys(profilePayload).length) {
        const { clause, params } = buildUpdateClause(profilePayload, ['full_name', 'role', 'is_active']);
        await run(`update profiles set ${clause} where id = ?`, [...params, request.params.id]);
      }
    });

    response.json(await getUserById(request.params.id));
  }),
);

app.get(
  '/api/employees',
  requireAuth,
  asyncHandler(async (request, response) => {
    response.json(await listEmployeesWithRules({ position: request.query.position }));
  }),
);

app.post(
  '/api/employees/photo',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.employees),
  asyncHandler(async (request, response) => {
    const fileName = String(request.body?.fileName || 'employee-photo');
    const contentType = String(request.body?.contentType || '');
    const base64Body = String(request.body?.dataUrl || '');

    if (!base64Body.startsWith('data:') || !base64Body.includes(';base64,')) {
      throw createHttpError(400, 'Format upload foto tidak valid.');
    }

    const [, rawMimeType = contentType, encodedData = ''] = base64Body.match(/^data:(.*?);base64,(.*)$/) || [];

    if (!encodedData) {
      throw createHttpError(400, 'File foto tidak valid.');
    }

    const extension = path.extname(fileName || '').toLowerCase() || (
      rawMimeType === 'image/png' ? '.png' : rawMimeType === 'image/webp' ? '.webp' : '.jpg'
    );
    const safeFileName = fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    const targetDirectory = path.join(uploadsDir, 'employee-photos');
    const savedFileName = `${request.auth.user.id}-${Date.now()}-${safeFileName || 'photo'}${safeFileName.endsWith(extension) ? '' : extension}`;
    const absolutePath = path.join(targetDirectory, savedFileName);

    await fs.mkdir(targetDirectory, { recursive: true });
    await fs.writeFile(absolutePath, Buffer.from(encodedData, 'base64'));

    response.status(201).json({
      path: `employee-photos/${savedFileName}`,
      publicUrl: `/api/uploads/employee-photos/${savedFileName}`,
    });
  }),
);

app.post(
  '/api/employees',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.employees),
  asyncHandler(async (request, response) => {
    const payload = normalizeEmployeePayload(request.body);
    const id = randomUUID();
    await run(
      `
        insert into employees (
          id, name, position, phone, email, gender, kasir, pimpinan_shift, shift_pagi, shift_siang,
          off_day_mode, off_day_weekdays, holiday_mandatory_off, status, hierarchy_order, photo_url, created_at, created_by
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        payload.name,
        payload.position,
        payload.phone,
        payload.email,
        payload.gender,
        payload.kasir,
        payload.pimpinan_shift,
        payload.shift_pagi,
        payload.shift_siang,
        payload.off_day_mode,
        payload.off_day_weekdays,
        payload.holiday_mandatory_off,
        payload.status,
        payload.hierarchy_order,
        payload.photo_url,
        nowIso(),
        payload.created_by || request.auth.user.id,
      ],
    );
    response.status(201).json(await getEmployeeById(id));
  }),
);

app.put(
  '/api/employees/:id',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.employees),
  asyncHandler(async (request, response) => {
    const existingRow = await getEmployeeById(request.params.id);

    if (!existingRow) {
      throw createHttpError(404, 'Pegawai tidak ditemukan.');
    }

    const payload = normalizeEmployeePayload(request.body);
    await run(
      `
        update employees
        set
          name = ?, position = ?, phone = ?, email = ?, gender = ?, kasir = ?, pimpinan_shift = ?,
          shift_pagi = ?, shift_siang = ?, off_day_mode = ?, off_day_weekdays = ?, holiday_mandatory_off = ?,
          status = ?, hierarchy_order = ?, photo_url = ?
        where id = ?
      `,
      [
        payload.name,
        payload.position,
        payload.phone,
        payload.email,
        payload.gender,
        payload.kasir,
        payload.pimpinan_shift,
        payload.shift_pagi,
        payload.shift_siang,
        payload.off_day_mode,
        payload.off_day_weekdays,
        payload.holiday_mandatory_off,
        payload.status,
        payload.hierarchy_order,
        payload.photo_url,
        request.params.id,
      ],
    );
    response.json(await getEmployeeById(request.params.id));
  }),
);

app.put(
  '/api/employees/:id/separation-rules',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.employees),
  asyncHandler(async (request, response) => {
    await replaceEmployeeSeparationRules(
      request.params.id,
      request.body?.restrictedEmployeeIds,
      request.body?.createdBy || request.auth.user.id,
    );
    response.json({ success: true });
  }),
);

app.delete(
  '/api/employees/:id',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.employees),
  asyncHandler(async (request, response) => {
    await run('delete from employees where id = ?', [request.params.id]);
    response.json({ success: true });
  }),
);

app.post(
  '/api/schedules/prune',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.schedules),
  asyncHandler(async (_request, response) => {
    const retentionStartDate = getScheduleHistoryStartDate();
    const result = await run('delete from schedules where date < ?', [retentionStartDate]);
    response.json({ success: true, changes: result.changes });
  }),
);

app.get(
  '/api/schedules',
  requireAuth,
  asyncHandler(async (request, response) => {
    const filters = {
      date: request.query.date,
      dateFrom: request.query.dateFrom,
      dateTo: request.query.dateTo,
      employeeId: request.query.employeeId,
    };

    if (filters.date && filters.date < getScheduleHistoryStartDate()) {
      response.json([]);
      return;
    }

    if (filters.dateTo && filters.dateTo < getScheduleHistoryStartDate()) {
      response.json([]);
      return;
    }

    if (filters.dateFrom && filters.dateFrom < getScheduleHistoryStartDate()) {
      filters.dateFrom = getScheduleHistoryStartDate();
    }

    response.json(await getScheduleRows(filters));
  }),
);

app.post(
  '/api/schedules',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.schedules),
  asyncHandler(async (request, response) => {
    const payload = normalizeSchedulePayload(request.body, request.auth.user.id);
    const id = randomUUID();
    await run(
      `
        insert into schedules (id, date, employee_id, shift_type, start_time, end_time, notes, created_at, created_by)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [id, payload.date, payload.employee_id, payload.shift_type, payload.start_time, payload.end_time, payload.notes, nowIso(), payload.created_by],
    );
    const createdRow = await (async () => {
      const rows = await getScheduleRows({ date: payload.date, employeeId: payload.employee_id });
      return rows.find((row) => row.id === id) || rows[0] || null;
    })();
    response.status(201).json(createdRow);
  }),
);

app.put(
  '/api/schedules/:id',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.schedules),
  asyncHandler(async (request, response) => {
    const payload = normalizeSchedulePayload(request.body, request.auth.user.id);
    await run(
      `
        update schedules
        set date = ?, employee_id = ?, shift_type = ?, start_time = ?, end_time = ?, notes = ?
        where id = ?
      `,
      [payload.date, payload.employee_id, payload.shift_type, payload.start_time, payload.end_time, payload.notes, request.params.id],
    );
    response.json(await getScheduleById(request.params.id));
  }),
);

app.post(
  '/api/schedules/upsert',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.schedules),
  asyncHandler(async (request, response) => {
    const payload = Array.isArray(request.body) ? request.body : [];

    if (!payload.length) {
      response.json([]);
      return;
    }

    await withTransaction(async () => {
      for (const item of payload) {
        const schedule = normalizeSchedulePayload(item, request.auth.user.id);
        await run(
          `
            insert into schedules (id, date, employee_id, shift_type, start_time, end_time, notes, created_at, created_by)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(date, employee_id) do update set
              shift_type = excluded.shift_type,
              start_time = excluded.start_time,
              end_time = excluded.end_time,
              notes = excluded.notes,
              created_by = excluded.created_by
          `,
          [
            item.id || randomUUID(),
            schedule.date,
            schedule.employee_id,
            schedule.shift_type,
            schedule.start_time,
            schedule.end_time,
            schedule.notes,
            nowIso(),
            schedule.created_by,
          ],
        );
      }
    });

    const dateKeys = Array.from(new Set(payload.map((item) => normalizeSchedulePayload(item, request.auth.user.id).date)));
    const placeholders = dateKeys.map(() => '?').join(', ');
    const rows = await all(
      `
        select
          s.id,
          s.date,
          s.employee_id,
          s.shift_type,
          s.start_time,
          s.end_time,
          s.notes,
          s.created_at,
          s.created_by,
          e.name as employee_name,
          e.position as employee_position,
          e.photo_url as employee_photo_url
        from schedules s
        join employees e on e.id = s.employee_id
        where s.date in (${placeholders})
        order by s.date asc, e.name asc
      `,
      dateKeys,
    );
    response.json(rows.map(mapScheduleRow));
  }),
);

app.post(
  '/api/schedules/bulk',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.schedules),
  asyncHandler(async (request, response) => {
    const payload = Array.isArray(request.body) ? request.body : [];

    await withTransaction(async () => {
      for (const item of payload) {
        const schedule = normalizeSchedulePayload(item, request.auth.user.id);
        await run(
          `
            insert or ignore into schedules (id, date, employee_id, shift_type, start_time, end_time, notes, created_at, created_by)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [item.id || randomUUID(), schedule.date, schedule.employee_id, schedule.shift_type, schedule.start_time, schedule.end_time, schedule.notes, nowIso(), schedule.created_by],
        );
      }
    });

    response.status(201).json({ success: true });
  }),
);

app.post(
  '/api/schedules/delete-by-ids',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.schedules),
  asyncHandler(async (request, response) => {
    const ids = Array.from(new Set((Array.isArray(request.body?.ids) ? request.body.ids : []).filter(Boolean)));

    if (!ids.length) {
      response.json({ success: true });
      return;
    }

    const placeholders = ids.map(() => '?').join(', ');
    await run(`delete from schedules where id in (${placeholders})`, ids);
    response.json({ success: true });
  }),
);

app.delete(
  '/api/schedules/:id',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.schedules),
  asyncHandler(async (request, response) => {
    await run('delete from schedules where id = ?', [request.params.id]);
    response.json({ success: true });
  }),
);

app.delete(
  '/api/schedules',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.schedules),
  asyncHandler(async (request, response) => {
    const conditions = [];
    const params = [];

    if (request.query.date) {
      conditions.push('date = ?');
      params.push(request.query.date);
    }

    if (request.query.dateFrom) {
      conditions.push('date >= ?');
      params.push(request.query.dateFrom);
    }

    if (request.query.dateTo) {
      conditions.push('date <= ?');
      params.push(request.query.dateTo);
    }

    if (request.query.employeeId && request.query.employeeId !== 'all') {
      conditions.push('employee_id = ?');
      params.push(request.query.employeeId);
    }

    if (!conditions.length && String(request.query.all || '') !== 'true') {
      response.json({ success: true });
      return;
    }

    const sql = conditions.length ? `delete from schedules where ${conditions.join(' and ')}` : 'delete from schedules';
    await run(sql, params);
    response.json({ success: true });
  }),
);

app.get(
  '/api/sales/month-target',
  requireAuth,
  asyncHandler(async (request, response) => {
    const monthStart = request.query.monthStart ? parseDateKey(String(request.query.monthStart)).toISOString().slice(0, 10) : '';

    if (!monthStart) {
      response.json(null);
      return;
    }

    const row = await get('select * from sales_month_targets where month_start = ?', [monthStart]);
    response.json(mapSalesMonthTargetRow(row));
  }),
);

app.put(
  '/api/sales/month-target',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.sales_reports),
  asyncHandler(async (request, response) => {
    const payload = normalizeSalesMonthTargetPayload(request.body);
    await run(
      `
        insert into sales_month_targets (id, month_start, target_amount, created_at, created_by)
        values (?, ?, ?, ?, ?)
        on conflict(month_start) do update set
          target_amount = excluded.target_amount,
          created_by = excluded.created_by
      `,
      [randomUUID(), payload.month_start, payload.target_amount, nowIso(), request.auth.user.id],
    );
    const row = await get('select * from sales_month_targets where month_start = ?', [payload.month_start]);
    response.json(mapSalesMonthTargetRow(row));
  }),
);

app.get(
  '/api/sales/daily',
  requireAuth,
  asyncHandler(async (request, response) => {
    const conditions = [];
    const params = [];

    if (request.query.dateFrom) {
      conditions.push('date >= ?');
      params.push(request.query.dateFrom);
    }

    if (request.query.dateTo) {
      conditions.push('date <= ?');
      params.push(request.query.dateTo);
    }

    const sql = conditions.length ? `select * from sales_daily_reports where ${conditions.join(' and ')}` : 'select * from sales_daily_reports';
    const rows = await all(`${sql} order by date asc`, params);
    response.json(rows.map(mapSalesDailyReportRow));
  }),
);

app.put(
  '/api/sales/daily',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.sales_reports),
  asyncHandler(async (request, response) => {
    const payload = normalizeSalesDailyPayload(request.body);
    await run(
      `
        insert into sales_daily_reports (id, date, sales_amount, receipt_count, created_at, created_by)
        values (?, ?, ?, ?, ?, ?)
        on conflict(date) do update set
          sales_amount = excluded.sales_amount,
          receipt_count = excluded.receipt_count,
          created_by = excluded.created_by
      `,
      [randomUUID(), payload.date, payload.sales_amount, payload.receipt_count, nowIso(), request.auth.user.id],
    );
    const row = await get('select * from sales_daily_reports where date = ?', [payload.date]);
    response.json(mapSalesDailyReportRow(row));
  }),
);

app.delete(
  '/api/sales/daily/:date',
  requireAuth,
  requireRoles(ROLE_CAN_MANAGE.sales_reports),
  asyncHandler(async (request, response) => {
    const dateValue = parseDateKey(request.params.date).toISOString().slice(0, 10);
    await run('delete from sales_daily_reports where date = ?', [dateValue]);
    response.json({ success: true });
  }),
);

app.use((error, _request, response, _next) => {
  const status = Number(error?.status || 500);
  const message = error?.message || 'Terjadi kesalahan pada server lokal.';

  if (status >= 500) {
    console.error(error);
  }

  response.status(status).json({
    error: message,
  });
});

await initializeDatabase();

app.listen(PORT, () => {
  console.log(`Store Staff Manager backend running on port ${PORT}`);
});
