import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import sqlite3 from 'sqlite3';

const sqlite = sqlite3.verbose();
const serverDir = path.dirname(fileURLToPath(import.meta.url));

export const databasePath = path.join(serverDir, 'database.sqlite');
export const uploadsDir = path.join(serverDir, 'uploads');
export const ROLE_VALUES = ['super_admin', 'admin', 'viewer'];
export const SESSION_DURATION_DAYS = 30;
export const DEFAULT_ADMIN_EMAIL = 'admin@t51t.local';
export const DEFAULT_ADMIN_PASSWORD = 'admin123';
export const DEFAULT_ADMIN_NAME = 'Administrator';
export const DEFAULT_OFF_DAY_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

const db = new sqlite.Database(databasePath);

function normalizeTimestamp(value) {
  if (!value) {
    return null;
  }

  if (value.includes('T')) {
    return value;
  }

  return new Date(String(value).replace(' ', 'T') + 'Z').toISOString();
}

function parseJsonArray(value, fallback = []) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [...fallback];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [...fallback];
  } catch {
    return [...fallback];
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function addDaysIso(dateValue, amount) {
  const date = new Date(dateValue);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString();
}

export function createPasswordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPasswordHash(password, storedHash) {
  const [salt, expectedHash] = String(storedHash || '').split(':');

  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = scryptSync(String(password), salt, 64);
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  if (actualHash.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualHash, expectedBuffer);
}

export function createSessionToken() {
  return randomBytes(48).toString('hex');
}

export function mapProfileRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email || null,
    full_name: row.full_name || '',
    role: row.role || 'viewer',
    is_active: Boolean(row.is_active),
    created_at: normalizeTimestamp(row.created_at),
  };
}

export function mapEmployeeRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    position: row.position,
    phone: row.phone || null,
    email: row.email || null,
    gender: row.gender || null,
    kasir: Boolean(row.kasir),
    pimpinan_shift: Boolean(row.pimpinan_shift),
    shift_pagi: Boolean(row.shift_pagi),
    shift_siang: Boolean(row.shift_siang),
    off_day_mode: row.off_day_mode || 'all',
    off_day_weekdays: parseJsonArray(row.off_day_weekdays, DEFAULT_OFF_DAY_WEEKDAYS).map((value) => Number(value)),
    holiday_mandatory_off: Boolean(row.holiday_mandatory_off),
    status: row.status || 'aktif',
    hierarchy_order: Number(row.hierarchy_order || 0),
    photo_url: row.photo_url || null,
    created_at: normalizeTimestamp(row.created_at),
    created_by: row.created_by || null,
  };
}

export function mapCashReportRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    date: row.date,
    type: row.type,
    amount: Number(row.amount || 0),
    category: row.category,
    description: row.description || null,
    created_by: row.created_by || null,
    created_at: normalizeTimestamp(row.created_at),
  };
}

export function mapSalesMonthTargetRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    month_start: row.month_start,
    target_amount: Number(row.target_amount || 0),
    created_by: row.created_by || null,
    created_at: normalizeTimestamp(row.created_at),
  };
}

export function mapSalesDailyReportRow(row) {
  if (!row) {
    return null;
  }

  const salesAmount = Number(row.sales_amount || 0);
  const receiptCount = Number(row.receipt_count || 0);

  return {
    id: row.id,
    date: row.date,
    sales_amount: salesAmount,
    receipt_count: receiptCount,
    apc: receiptCount > 0 ? Math.round((salesAmount / receiptCount) * 100) / 100 : 0,
    created_by: row.created_by || null,
    created_at: normalizeTimestamp(row.created_at),
  };
}

export function mapScheduleRow(row) {
  if (!row) {
    return null;
  }

  const schedule = {
    id: row.id,
    date: row.date,
    employee_id: row.employee_id,
    shift_type: row.shift_type,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    notes: row.notes || null,
    created_by: row.created_by || null,
    created_at: normalizeTimestamp(row.created_at),
  };

  if (Object.prototype.hasOwnProperty.call(row, 'employee_name')) {
    schedule.employee = {
      id: row.employee_id,
      name: row.employee_name,
      position: row.employee_position,
      photo_url: row.employee_photo_url || null,
    };
  }

  return schedule;
}

export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function handleRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        lastID: this.lastID,
        changes: this.changes,
      });
    });
  });
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row || null);
    });
  });
}

export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
    });
  });
}

export function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export async function withTransaction(work) {
  await exec('BEGIN');

  try {
    const result = await work();
    await exec('COMMIT');
    return result;
  } catch (error) {
    await exec('ROLLBACK');
    throw error;
  }
}

async function ensureDefaultAdmin() {
  const normalizedEmail = DEFAULT_ADMIN_EMAIL.toLowerCase();
  const existingUser = await get('select id from users where email = ?', [normalizedEmail]);

  if (!existingUser) {
    const userId = randomUUID();
    const createdAt = nowIso();

    await run(
      'insert into users (id, email, password_hash, created_at) values (?, ?, ?, ?)',
      [userId, normalizedEmail, createPasswordHash(DEFAULT_ADMIN_PASSWORD), createdAt],
    );
    await run(
      'insert into profiles (id, full_name, role, is_active, created_at) values (?, ?, ?, ?, ?)',
      [userId, DEFAULT_ADMIN_NAME, 'super_admin', 1, createdAt],
    );
    return;
  }

  const existingProfile = await get('select id from profiles where id = ?', [existingUser.id]);

  if (!existingProfile) {
    await run(
      'insert into profiles (id, full_name, role, is_active, created_at) values (?, ?, ?, ?, ?)',
      [existingUser.id, DEFAULT_ADMIN_NAME, 'super_admin', 1, nowIso()],
    );
    return;
  }

  await run(
    'update profiles set role = ?, is_active = ? where id = ?',
    ['super_admin', 1, existingUser.id],
  );
}

export async function initializeDatabase() {
  await fs.mkdir(uploadsDir, { recursive: true });
  await exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  await exec(`
    create table if not exists users (
      id text primary key,
      email text not null unique,
      password_hash text not null,
      created_at text not null
    );

    create table if not exists profiles (
      id text primary key references users(id) on delete cascade,
      full_name text not null default '',
      role text not null default 'viewer',
      is_active integer not null default 1,
      created_at text not null
    );

    create table if not exists sessions (
      id text primary key,
      token text not null unique,
      user_id text not null references users(id) on delete cascade,
      created_at text not null,
      expires_at text not null
    );

    create table if not exists employees (
      id text primary key,
      name text not null,
      position text not null,
      phone text,
      email text,
      gender text,
      kasir integer not null default 0,
      pimpinan_shift integer not null default 0,
      shift_pagi integer not null default 1,
      shift_siang integer not null default 1,
      off_day_mode text not null default 'all',
      off_day_weekdays text not null default '[1,2,3,4,5,6,0]',
      holiday_mandatory_off integer not null default 0,
      status text not null default 'aktif',
      hierarchy_order integer not null default 1,
      photo_url text,
      created_at text not null,
      created_by text references users(id) on delete set null
    );

    create table if not exists employee_shift_separation_rules (
      id text primary key,
      employee_id text not null references employees(id) on delete cascade,
      restricted_employee_id text not null references employees(id) on delete cascade,
      created_at text not null,
      created_by text references users(id) on delete set null,
      unique (employee_id, restricted_employee_id),
      check (employee_id <> restricted_employee_id)
    );

    create table if not exists cash_reports (
      id text primary key,
      date text not null,
      type text not null,
      amount real not null default 0,
      category text not null,
      description text,
      created_at text not null,
      created_by text references users(id) on delete set null
    );

    create table if not exists schedules (
      id text primary key,
      date text not null,
      employee_id text not null references employees(id) on delete cascade,
      shift_type text not null,
      start_time text,
      end_time text,
      notes text,
      created_at text not null,
      created_by text references users(id) on delete set null,
      unique (date, employee_id)
    );

    create table if not exists sales_month_targets (
      id text primary key,
      month_start text not null unique,
      target_amount real not null default 0,
      created_at text not null,
      created_by text references users(id) on delete set null
    );

    create table if not exists sales_daily_reports (
      id text primary key,
      date text not null unique,
      sales_amount real not null default 0,
      receipt_count integer not null default 0,
      created_at text not null,
      created_by text references users(id) on delete set null
    );

    create index if not exists idx_profiles_role on profiles(role);
    create index if not exists idx_employees_position on employees(position);
    create index if not exists idx_employees_hierarchy_order on employees(hierarchy_order);
    create index if not exists idx_employee_shift_separation_rules_employee_id on employee_shift_separation_rules(employee_id);
    create index if not exists idx_employee_shift_separation_rules_restricted_employee_id on employee_shift_separation_rules(restricted_employee_id);
    create index if not exists idx_cash_reports_date on cash_reports(date desc);
    create index if not exists idx_cash_reports_type on cash_reports(type);
    create index if not exists idx_schedules_date on schedules(date);
    create index if not exists idx_schedules_employee_id on schedules(employee_id);
    create index if not exists idx_sales_month_targets_month_start on sales_month_targets(month_start);
    create index if not exists idx_sales_daily_reports_date on sales_daily_reports(date);
  `);
  await ensureDefaultAdmin();
}
