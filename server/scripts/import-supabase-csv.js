import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_OFF_DAY_WEEKDAYS,
  all,
  databasePath,
  get,
  initializeDatabase,
  run,
  withTransaction,
} from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '..');
const defaultSourceDir = path.join(os.homedir(), 'Downloads');
const sourceDir = resolveSourceDir(process.argv.slice(2));
const backupEnabled = !process.argv.includes('--no-backup');
const fileNames = {
  employees: 'employees_rows.csv',
  employeeShiftSeparationRules: 'employee_shift_separation_rules_rows.csv',
  cashReports: 'cash_reports_rows.csv',
  salesDailyReports: 'sales_daily_reports_rows.csv',
  salesMonthlyTargets: 'sales_monthly_targets_rows.csv',
};

function resolveSourceDir(argumentsList) {
  const sourceDirFlagIndex = argumentsList.findIndex((value) => value === '--sourceDir');

  if (sourceDirFlagIndex >= 0 && argumentsList[sourceDirFlagIndex + 1]) {
    return path.resolve(argumentsList[sourceDirFlagIndex + 1]);
  }

  return process.env.SUPABASE_CSV_DIR
    ? path.resolve(process.env.SUPABASE_CSV_DIR)
    : defaultSourceDir;
}

function parseCsv(text) {
  const rows = [];
  const normalizedText = String(text || '').replace(/^\uFEFF/, '');
  let currentField = '';
  let currentRow = [];
  let insideQuotes = false;

  for (let index = 0; index < normalizedText.length; index += 1) {
    const character = normalizedText[index];
    const nextCharacter = normalizedText[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentField += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !insideQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }

      currentRow.push(currentField);
      if (currentRow.some((value) => String(value).trim() !== '')) {
        rows.push(currentRow);
      }
      currentField = '';
      currentRow = [];
      continue;
    }

    currentField += character;
  }

  if (currentField !== '' || currentRow.length) {
    currentRow.push(currentField);
    if (currentRow.some((value) => String(value).trim() !== '')) {
      rows.push(currentRow);
    }
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((value) => String(value).trim());
  return rows.slice(1).map((values) => {
    const record = {};

    headers.forEach((header, index) => {
      record[header] = values[index] ?? '';
    });

    return record;
  });
}

async function readCsvRecords(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return parseCsv(content);
}

function toNullIfEmpty(value) {
  const normalizedValue = String(value ?? '').trim();
  return normalizedValue ? normalizedValue : null;
}

function toBooleanInt(value, fallback = 0) {
  const normalizedValue = String(value ?? '').trim().toLowerCase();

  if (!normalizedValue) {
    return fallback;
  }

  if (['true', '1', 'yes'].includes(normalizedValue)) {
    return 1;
  }

  if (['false', '0', 'no'].includes(normalizedValue)) {
    return 0;
  }

  return fallback;
}

function toInteger(value, fallback = 0) {
  const parsedValue = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function toNumber(value, fallback = 0) {
  const parsedValue = Number.parseFloat(String(value ?? '').trim());
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function normalizeTimestamp(value) {
  const normalizedValue = String(value ?? '').trim();

  if (!normalizedValue) {
    return new Date().toISOString();
  }

  const dateValue = new Date(
    normalizedValue.includes('T')
      ? normalizedValue
      : normalizedValue.replace(' ', 'T'),
  );

  return Number.isNaN(dateValue.getTime())
    ? new Date().toISOString()
    : dateValue.toISOString();
}

function normalizeDateKey(value) {
  const normalizedValue = String(value ?? '').trim();
  return normalizedValue ? normalizedValue.slice(0, 10) : null;
}

function normalizeOffDayWeekdays(value) {
  const normalizedValue = String(value ?? '').trim();

  if (!normalizedValue) {
    return JSON.stringify(DEFAULT_OFF_DAY_WEEKDAYS);
  }

  try {
    const parsedValue = JSON.parse(normalizedValue);
    const weekdays = Array.isArray(parsedValue)
      ? parsedValue
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)
      : [];

    return JSON.stringify(weekdays.length ? weekdays : DEFAULT_OFF_DAY_WEEKDAYS);
  } catch {
    return JSON.stringify(DEFAULT_OFF_DAY_WEEKDAYS);
  }
}

function normalizePair(employeeId, restrictedEmployeeId) {
  return [String(employeeId || '').trim(), String(restrictedEmployeeId || '').trim()].sort((left, right) => left.localeCompare(right));
}

async function createDatabaseBackupIfNeeded() {
  if (!backupEnabled) {
    return null;
  }

  const existingFiles = await Promise.all([
    exists(databasePath),
    exists(`${databasePath}-shm`),
    exists(`${databasePath}-wal`),
  ]);

  if (!existingFiles.some(Boolean)) {
    return null;
  }

  const backupDirectory = path.join(serverDir, 'backups', `supabase-import-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await fs.mkdir(backupDirectory, { recursive: true });

  const copyTargets = [
    databasePath,
    `${databasePath}-shm`,
    `${databasePath}-wal`,
  ];

  for (const filePath of copyTargets) {
    if (await exists(filePath)) {
      await fs.copyFile(filePath, path.join(backupDirectory, path.basename(filePath)));
    }
  }

  return backupDirectory;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadSourceData() {
  const loadedData = {};

  for (const [key, fileName] of Object.entries(fileNames)) {
    const filePath = path.join(sourceDir, fileName);

    if (!(await exists(filePath))) {
      throw new Error(`File CSV tidak ditemukan: ${filePath}`);
    }

    loadedData[key] = await readCsvRecords(filePath);
  }

  return loadedData;
}

async function getFallbackCreatedBy() {
  const row = await get(
    `
      select u.id
      from users u
      join profiles p on p.id = u.id
      where p.role = 'super_admin'
      order by p.created_at asc
      limit 1
    `,
  );

  if (!row?.id) {
    throw new Error('Akun super admin lokal tidak ditemukan. Jalankan inisialisasi database terlebih dulu.');
  }

  return row.id;
}

async function getKnownUserIds() {
  const rows = await all('select id from users');
  return new Set(rows.map((row) => String(row.id)));
}

function createCreatedByResolver(knownUserIds, fallbackCreatedBy) {
  const remappedSourceUserIds = new Set();

  return {
    remappedSourceUserIds,
    resolve(rawValue) {
      const normalizedValue = String(rawValue ?? '').trim();

      if (!normalizedValue) {
        return null;
      }

      if (knownUserIds.has(normalizedValue)) {
        return normalizedValue;
      }

      remappedSourceUserIds.add(normalizedValue);
      return fallbackCreatedBy;
    },
  };
}

async function importEmployees(records, resolveCreatedBy) {
  let importedCount = 0;

  for (const record of records) {
    await run(
      `
        insert into employees (
          id, name, position, phone, email, gender, kasir, pimpinan_shift, shift_pagi, shift_siang,
          off_day_mode, off_day_weekdays, holiday_mandatory_off, status, hierarchy_order, photo_url, created_at, created_by
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(id) do update set
          name = excluded.name,
          position = excluded.position,
          phone = excluded.phone,
          email = excluded.email,
          gender = excluded.gender,
          kasir = excluded.kasir,
          pimpinan_shift = excluded.pimpinan_shift,
          shift_pagi = excluded.shift_pagi,
          shift_siang = excluded.shift_siang,
          off_day_mode = excluded.off_day_mode,
          off_day_weekdays = excluded.off_day_weekdays,
          holiday_mandatory_off = excluded.holiday_mandatory_off,
          status = excluded.status,
          hierarchy_order = excluded.hierarchy_order,
          photo_url = excluded.photo_url,
          created_at = excluded.created_at,
          created_by = excluded.created_by
      `,
      [
        String(record.id).trim(),
        String(record.name || '').trim(),
        String(record.position || '').trim(),
        toNullIfEmpty(record.phone),
        toNullIfEmpty(record.email)?.toLowerCase() || null,
        toNullIfEmpty(record.gender)?.toLowerCase() || null,
        toBooleanInt(record.kasir),
        toBooleanInt(record.pimpinan_shift),
        toBooleanInt(record.shift_pagi, 1),
        toBooleanInt(record.shift_siang, 1),
        String(record.off_day_mode || 'all').trim().toLowerCase() === 'custom' ? 'custom' : 'all',
        normalizeOffDayWeekdays(record.off_day_weekdays),
        toBooleanInt(record.holiday_mandatory_off),
        String(record.status || 'aktif').trim().toLowerCase() || 'aktif',
        toInteger(record.hierarchy_order, 1),
        toNullIfEmpty(record.photo_url),
        normalizeTimestamp(record.created_at),
        resolveCreatedBy(record.created_by),
      ],
    );

    importedCount += 1;
  }

  return importedCount;
}

async function importEmployeeShiftSeparationRules(records, resolveCreatedBy) {
  let importedCount = 0;
  let skippedCount = 0;

  for (const record of records) {
    const [employeeId, restrictedEmployeeId] = normalizePair(record.employee_id, record.restricted_employee_id);

    if (!employeeId || !restrictedEmployeeId || employeeId === restrictedEmployeeId) {
      skippedCount += 1;
      continue;
    }

    const employeeRows = await all(
      'select id from employees where id in (?, ?)',
      [employeeId, restrictedEmployeeId],
    );

    if (employeeRows.length !== 2) {
      skippedCount += 1;
      continue;
    }

    await run(
      `
        insert into employee_shift_separation_rules (id, employee_id, restricted_employee_id, created_at, created_by)
        values (?, ?, ?, ?, ?)
        on conflict(employee_id, restricted_employee_id) do update set
          created_at = excluded.created_at,
          created_by = excluded.created_by
      `,
      [
        String(record.id || `${employeeId}-${restrictedEmployeeId}`).trim(),
        employeeId,
        restrictedEmployeeId,
        normalizeTimestamp(record.created_at),
        resolveCreatedBy(record.created_by),
      ],
    );

    importedCount += 1;
  }

  return { importedCount, skippedCount };
}

async function importCashReports(records, resolveCreatedBy) {
  let importedCount = 0;

  for (const record of records) {
    await run(
      `
        insert into cash_reports (id, date, type, amount, category, description, created_at, created_by)
        values (?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(id) do update set
          date = excluded.date,
          type = excluded.type,
          amount = excluded.amount,
          category = excluded.category,
          description = excluded.description,
          created_at = excluded.created_at,
          created_by = excluded.created_by
      `,
      [
        String(record.id).trim(),
        normalizeDateKey(record.date),
        String(record.type || '').trim().toLowerCase(),
        toNumber(record.amount),
        String(record.category || '').trim() || '-',
        toNullIfEmpty(record.description),
        normalizeTimestamp(record.created_at),
        resolveCreatedBy(record.created_by),
      ],
    );

    importedCount += 1;
  }

  return importedCount;
}

async function importSalesDailyReports(records, resolveCreatedBy) {
  let importedCount = 0;

  for (const record of records) {
    await run(
      `
        insert into sales_daily_reports (id, date, sales_amount, receipt_count, created_at, created_by)
        values (?, ?, ?, ?, ?, ?)
        on conflict(date) do update set
          sales_amount = excluded.sales_amount,
          receipt_count = excluded.receipt_count,
          created_at = excluded.created_at,
          created_by = excluded.created_by
      `,
      [
        String(record.id).trim(),
        normalizeDateKey(record.date),
        toNumber(record.sales_amount),
        toInteger(record.receipt_count),
        normalizeTimestamp(record.created_at),
        resolveCreatedBy(record.created_by),
      ],
    );

    importedCount += 1;
  }

  return importedCount;
}

async function importSalesMonthTargets(records, resolveCreatedBy) {
  let importedCount = 0;

  for (const record of records) {
    await run(
      `
        insert into sales_month_targets (id, month_start, target_amount, created_at, created_by)
        values (?, ?, ?, ?, ?)
        on conflict(month_start) do update set
          target_amount = excluded.target_amount,
          created_at = excluded.created_at,
          created_by = excluded.created_by
      `,
      [
        String(record.id).trim(),
        normalizeDateKey(record.month_start),
        toNumber(record.target_amount),
        normalizeTimestamp(record.created_at),
        resolveCreatedBy(record.created_by),
      ],
    );

    importedCount += 1;
  }

  return importedCount;
}

async function getTableCounts() {
  const [employees, rules, cashReports, salesDailyReports, salesMonthTargets] = await Promise.all([
    get('select count(*) as count from employees'),
    get('select count(*) as count from employee_shift_separation_rules'),
    get('select count(*) as count from cash_reports'),
    get('select count(*) as count from sales_daily_reports'),
    get('select count(*) as count from sales_month_targets'),
  ]);

  return {
    employees: employees?.count ?? 0,
    employee_shift_separation_rules: rules?.count ?? 0,
    cash_reports: cashReports?.count ?? 0,
    sales_daily_reports: salesDailyReports?.count ?? 0,
    sales_month_targets: salesMonthTargets?.count ?? 0,
  };
}

async function main() {
  await initializeDatabase();

  const backupDirectory = await createDatabaseBackupIfNeeded();
  const sourceData = await loadSourceData();
  const fallbackCreatedBy = await getFallbackCreatedBy();
  const knownUserIds = await getKnownUserIds();
  const createdByResolver = createCreatedByResolver(knownUserIds, fallbackCreatedBy);

  await withTransaction(async () => {
    await importEmployees(sourceData.employees, createdByResolver.resolve);
    await importCashReports(sourceData.cashReports, createdByResolver.resolve);
    await importSalesDailyReports(sourceData.salesDailyReports, createdByResolver.resolve);
    await importSalesMonthTargets(sourceData.salesMonthlyTargets, createdByResolver.resolve);
    await importEmployeeShiftSeparationRules(sourceData.employeeShiftSeparationRules, createdByResolver.resolve);
  });

  const tableCounts = await getTableCounts();

  console.log('Import Supabase CSV selesai.');
  console.log(`Source directory: ${sourceDir}`);
  if (backupDirectory) {
    console.log(`Backup database: ${backupDirectory}`);
  }
  console.log(`Fallback created_by: ${fallbackCreatedBy}`);
  console.log(`Remapped source user IDs: ${createdByResolver.remappedSourceUserIds.size || 0}`);
  if (createdByResolver.remappedSourceUserIds.size) {
    console.log(`Source IDs: ${Array.from(createdByResolver.remappedSourceUserIds).join(', ')}`);
  }
  console.log('Row totals after import:');
  Object.entries(tableCounts).forEach(([tableName, count]) => {
    console.log(`- ${tableName}: ${count}`);
  });
}

main().catch((error) => {
  console.error('Import Supabase CSV gagal.');
  console.error(error);
  process.exitCode = 1;
});
