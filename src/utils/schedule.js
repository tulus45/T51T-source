import { ACTIVE_EMPLOYEE_STATUSES, SHIFT_HOURS, SHIFT_TYPE_OPTIONS } from './constants';

const shiftSequence = SHIFT_TYPE_OPTIONS.map((item) => item.value);
const GENERATOR_SHIFT_TYPES = ['pagi', 'siang'];
const PREFERRED_WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_OFF_PER_DAY = 2;
const MIN_WORKING_PER_GENDER_PER_DAY = 2;

const SPECIAL_NAMES = {
  erda: 'erda ramdini',
};

const DEFAULT_ALLOWED_SHIFT_TYPES = ['pagi', 'siang', 'malam', 'libur'];
const DEFAULT_ALLOWED_OFF_WEEKDAYS = [...PREFERRED_WEEKDAY_ORDER];

export const SCHEDULE_RULE_SHIFT_OPTIONS = [
  { value: 'pagi', label: 'Pagi', shortLabel: 'Pg' },
  { value: 'siang', label: 'Siang', shortLabel: 'Si' },
];

export const SCHEDULE_RULE_WEEKDAY_OPTIONS = [
  { value: 1, label: 'Senin', shortLabel: 'Sn' },
  { value: 2, label: 'Selasa', shortLabel: 'Sl' },
  { value: 3, label: 'Rabu', shortLabel: 'Rb' },
  { value: 4, label: 'Kamis', shortLabel: 'Km' },
  { value: 5, label: 'Jumat', shortLabel: 'Jm' },
  { value: 6, label: 'Sabtu', shortLabel: 'Sb' },
  { value: 0, label: 'Minggu', shortLabel: 'Mg' },
];

function normalizeName(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeGender(value = '') {
  const normalized = String(value).trim().toLowerCase();

  if (normalized === 'laki-laki' || normalized === 'pria' || normalized === 'male') {
    return 'laki-laki';
  }

  if (normalized === 'perempuan' || normalized === 'wanita' || normalized === 'female') {
    return 'perempuan';
  }

  return '';
}

function sortWeekdayIndexes(values = []) {
  return [...values].sort(
    (leftDay, rightDay) => PREFERRED_WEEKDAY_ORDER.indexOf(leftDay) - PREFERRED_WEEKDAY_ORDER.indexOf(rightDay),
  );
}

function sanitizeAllowedWorkingShiftTypes(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(String))).filter((value) =>
    GENERATOR_SHIFT_TYPES.includes(value),
  );
}

function sanitizeAllowedOffWeekdays(values = []) {
  const normalizedValues = Array.from(new Set((Array.isArray(values) ? values : []).map((value) => Number(value)))).filter(
    (value) => PREFERRED_WEEKDAY_ORDER.includes(value),
  );

  return sortWeekdayIndexes(normalizedValues);
}
function parseDateKey(value) {

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    throw new Error(`Tanggal tidak valid: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (toDateKey(parsed) !== value) {
    throw new Error(`Tanggal tidak valid: ${value}`);
  }

  return parsed;
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + amount);
  return nextDate;
}

function getDayIndex(dateKey) {
  return parseDateKey(dateKey).getUTCDay();
}

function isWeekendDayIndex(dayIndex) {
  return dayIndex === 0 || dayIndex === 6;
}

function getWeekStartKey(dateKey) {
  const date = parseDateKey(dateKey);
  const dayIndex = date.getUTCDay();
  const offset = dayIndex === 0 ? -6 : 1 - dayIndex;
  return toDateKey(addDays(date, offset));
}

function buildDateKeysBetween(startDateKey, endDateKey) {
  const startDate = parseDateKey(startDateKey);
  const endDate = parseDateKey(endDateKey);

  if (startDate > endDate) {
    throw new Error('Rentang tanggal tidak valid.');
  }

  const dateKeys = [];

  for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
    dateKeys.push(toDateKey(cursor));
  }

  return dateKeys;
}

function daysBetween(leftDateKey, rightDateKey) {
  const leftDate = parseDateKey(leftDateKey);
  const rightDate = parseDateKey(rightDateKey);
  return Math.round((leftDate - rightDate) / DAY_IN_MS);
}

function compareByDate(leftDateKey, rightDateKey) {
  return leftDateKey.localeCompare(rightDateKey);
}

function getMonthMeta(monthValue) {
  const match = String(monthValue).match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    throw new Error('Bulan harus menggunakan format YYYY-MM.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!year || month < 1 || month > 12) {
    throw new Error('Bulan harus menggunakan format YYYY-MM.');
  }

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));
  const dateKeys = [];

  for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
    dateKeys.push(toDateKey(cursor));
  }

  return {
    monthValue,
    startDate: toDateKey(startDate),
    endDate: toDateKey(endDate),
    dateKeys,
  };
}

function getWeekMeta(dateValue) {
  const referenceDate = toDateKey(parseDateKey(dateValue));
  const startDate = getWeekStartKey(referenceDate);
  const endDate = toDateKey(addDays(parseDateKey(startDate), 6));

  return {
    referenceDate,
    startDate,
    endDate,
    dateKeys: buildDateKeysBetween(startDate, endDate),
  };
}

function buildWeekBuckets(dateKeys) {
  const weekMap = new Map();

  dateKeys.forEach((dateKey) => {
    const weekStartKey = getWeekStartKey(dateKey);

    if (!weekMap.has(weekStartKey)) {
      weekMap.set(weekStartKey, []);
    }

    weekMap.get(weekStartKey).push(dateKey);
  });

  return Array.from(weekMap.entries())
    .sort(([leftWeek], [rightWeek]) => compareByDate(leftWeek, rightWeek))
    .map(([weekStartKey, dates]) => ({
      weekStartKey,
      dates: dates.sort(compareByDate),
    }));
}

function countEmployeesByGender(employees) {
  return employees.reduce(
    (accumulator, employee) => {
      accumulator[employee.normalizedGender] += 1;
      return accumulator;
    },
    {
      'laki-laki': 0,
      perempuan: 0,
    },
  );
}

function countEmployeesByRole(employees) {
  return employees.reduce(
    (accumulator, employee) => {
      if (employee.kasir) {
        accumulator.kasir += 1;
      }

      if (employee.pimpinan_shift) {
        accumulator.pimpinan_shift += 1;
      }

      return accumulator;
    },
    {
      kasir: 0,
      pimpinan_shift: 0,
    },
  );
}

function canWorkingEmployeesKeepShiftRoles(workingEmployees) {
  const roleCounts = countEmployeesByRole(workingEmployees);
  return roleCounts.kasir >= 2 && roleCounts.pimpinan_shift >= 2;
}

function getMaxOffCountForDate(dateKey, holidaySet = new Set()) {
  const dayIndex = getDayIndex(dateKey);

  return holidaySet.has(dateKey) || isWeekendDayIndex(dayIndex) ? Number.POSITIVE_INFINITY : MAX_OFF_PER_DAY;
}

function canUseHolidayExtraOffDate(employee, dateKey) {
  const dayIndex = getDayIndex(dateKey);
  return employee.allowedOffWeekdays.includes(dayIndex) || (employee.holidayMandatoryOff && isWeekendDayIndex(dayIndex));
}

function canOffCombinationKeepShiftGender(offEmployees, totalGenderCounts) {
  const offGenderCounts = countEmployeesByGender(offEmployees);

  return (
    totalGenderCounts['laki-laki'] - offGenderCounts['laki-laki'] >= MIN_WORKING_PER_GENDER_PER_DAY &&
    totalGenderCounts.perempuan - offGenderCounts.perempuan >= MIN_WORKING_PER_GENDER_PER_DAY
  );
}

function getOffEntriesForDate(offByDate, dateKey) {
  return offByDate.get(dateKey) || [];
}

function addOffEntry(plan, dateKey, employeeId, reason) {
  plan.offByDate.set(dateKey, [
    ...getOffEntriesForDate(plan.offByDate, dateKey),
    {
      employeeId,
      reason,
    },
  ]);

  plan.offEntriesByEmployee.get(employeeId).push({
    dateKey,
    reason,
  });
  plan.offEntriesByEmployee.get(employeeId).sort((left, right) => compareByDate(left.dateKey, right.dateKey));
}

function removeOffEntry(plan, dateKey, employeeId, reason) {
  const remainingEntries = getOffEntriesForDate(plan.offByDate, dateKey).filter(
    (entry) => !(entry.employeeId === employeeId && entry.reason === reason),
  );

  if (remainingEntries.length > 0) {
    plan.offByDate.set(dateKey, remainingEntries);
  } else {
    plan.offByDate.delete(dateKey);
  }

  const nextEntries = plan.offEntriesByEmployee
    .get(employeeId)
    .filter((entry) => !(entry.dateKey === dateKey && entry.reason === reason));

  plan.offEntriesByEmployee.set(employeeId, nextEntries);
}

function sortEmployees(employees) {
  return [...employees].sort((left, right) => {
    const hierarchyDiff = (left.hierarchy_order || 0) - (right.hierarchy_order || 0);

    if (hierarchyDiff !== 0) {
      return hierarchyDiff;
    }

    return left.name.localeCompare(right.name);
  });
}

function normalizeOffDayMode(value = '') {
  return String(value).trim().toLowerCase() === 'custom' ? 'custom' : 'all';
}

function getStoredAllowedWorkingShiftTypes(employee = {}) {
  const hasShiftFlags = Object.prototype.hasOwnProperty.call(employee, 'shift_pagi') || Object.prototype.hasOwnProperty.call(employee, 'shift_siang');

  if (!hasShiftFlags) {
    return {
      hasShiftFlags: false,
      allowedShiftTypes: [],
    };
  }

  return {
    hasShiftFlags: true,
    allowedShiftTypes: GENERATOR_SHIFT_TYPES.filter((shiftType) => Boolean(employee['shift_' + shiftType])),
  };
}

function buildEmployeeRuleConfig(employee = {}, override = {}) {
  const normalizedName = employee?.normalizedName || normalizeName(employee?.name || '');
  const isErda = normalizedName === SPECIAL_NAMES.erda;
  const hasAllowedWorkingShiftOverride = Array.isArray(override.allowedWorkingShiftTypes);
  const hasAllowedOffWeekdayOverride = Array.isArray(override.allowedOffWeekdays);
  const hasStoredOffDayMode = employee && Object.prototype.hasOwnProperty.call(employee, 'off_day_mode');
  const storedOffDayMode = normalizeOffDayMode(employee?.off_day_mode);
  const storedOffWeekdays = sanitizeAllowedOffWeekdays(employee?.off_day_weekdays);
  const { hasShiftFlags, allowedShiftTypes: storedAllowedWorkingShiftTypes } = getStoredAllowedWorkingShiftTypes(employee);
  const defaultAllowedWorkingShiftTypes = isErda
    ? ['pagi']
    : hasShiftFlags
      ? storedAllowedWorkingShiftTypes
      : GENERATOR_SHIFT_TYPES;
  const fallbackAllowedOffWeekdays = isErda ? [6, 0] : DEFAULT_ALLOWED_OFF_WEEKDAYS;
  const persistedAllowedOffWeekdays =
    storedOffDayMode === 'custom'
      ? storedOffWeekdays.length
        ? storedOffWeekdays
        : fallbackAllowedOffWeekdays
      : DEFAULT_ALLOWED_OFF_WEEKDAYS;
  const defaultAllowedOffWeekdays = hasStoredOffDayMode ? persistedAllowedOffWeekdays : fallbackAllowedOffWeekdays;
  const allowedWorkingShiftTypes = hasAllowedWorkingShiftOverride
    ? sanitizeAllowedWorkingShiftTypes(override.allowedWorkingShiftTypes)
    : [...defaultAllowedWorkingShiftTypes];
  const allowedOffWeekdays = hasAllowedOffWeekdayOverride
    ? sanitizeAllowedOffWeekdays(override.allowedOffWeekdays)
    : [...defaultAllowedOffWeekdays];

  return {
    allowedWorkingShiftTypes,
    allowedOffWeekdays,
    holidayMandatoryOff: Boolean(employee?.holiday_mandatory_off),
    singleWorkingShiftType: allowedWorkingShiftTypes.length === 1 ? allowedWorkingShiftTypes[0] : '',
    isWeekendOnlyOff: allowedOffWeekdays.length > 0 && allowedOffWeekdays.every((weekday) => isWeekendDayIndex(weekday)),
    isMorningShiftOnly: allowedWorkingShiftTypes.length === 1 && allowedWorkingShiftTypes[0] === 'pagi',
    manualAllowedShiftTypes:
      isErda || hasShiftFlags
        ? [...new Set([...(allowedWorkingShiftTypes.length ? allowedWorkingShiftTypes : defaultAllowedWorkingShiftTypes), 'libur'])]
        : DEFAULT_ALLOWED_SHIFT_TYPES,
  };
}

export function getEmployeeScheduleRuleConfig(employee, override = {}) {
  return buildEmployeeRuleConfig(employee, override);
}

export function validateScheduleRuleForEntry({ employee, date, shiftType }) {
  if (!employee || !date || !shiftType) {
    return;
  }

  const ruleConfig = getEmployeeScheduleRuleConfig(employee);

  if (shiftType === 'libur' && !canUseHolidayExtraOffDate(ruleConfig, date)) {
    throw new Error(`${employee.name} hanya bisa dijadwalkan libur pada hari yang diizinkan.`);
  }

  if (shiftType !== 'libur' && !ruleConfig.manualAllowedShiftTypes.includes(shiftType)) {
    throw new Error(`${employee.name} tidak bisa dijadwalkan pada shift ${shiftType}.`);
  }
}

function getSeparatedPairConflict(shiftEmployeeIds, separatedPairs, employeesById) {
  const normalizedShiftEmployeeIds = new Set(shiftEmployeeIds.map((employeeId) => String(employeeId)));
  const conflictingPair = separatedPairs.find(
    ([leftEmployeeId, rightEmployeeId]) =>
      normalizedShiftEmployeeIds.has(String(leftEmployeeId)) && normalizedShiftEmployeeIds.has(String(rightEmployeeId)),
  );

  if (!conflictingPair) {
    return null;
  }

  const leftEmployee = employeesById.get(String(conflictingPair[0]));
  const rightEmployee = employeesById.get(String(conflictingPair[1]));

  return {
    leftEmployeeName: leftEmployee?.name || 'Pegawai 1',
    rightEmployeeName: rightEmployee?.name || 'Pegawai 2',
  };
}

function validateScheduleDayRules({ activeEmployees, dateKey, employeesById, schedulesForDate, holidaySet, separatedPairs }) {
  const scheduleByEmployeeId = new Map();
  const shiftAssignments = {
    pagi: [],
    siang: [],
  };
  const dayIndex = getDayIndex(dateKey);
  let offCount = 0;

  schedulesForDate.forEach((schedule) => {
    const employeeId = String(schedule.employee_id);
    const employee = employeesById.get(employeeId);

    if (!employee) {
      return;
    }

    if (scheduleByEmployeeId.has(employeeId)) {
      throw new Error(`${employee.name} memiliki lebih dari 1 jadwal pada ${dateKey}.`);
    }

    scheduleByEmployeeId.set(employeeId, schedule);

    if (schedule.shift_type === 'libur') {
      const offAllowedByProfile = canUseHolidayExtraOffDate(employee, dateKey);
      const holidayForcedOff = holidaySet.has(dateKey) && employee.holidayMandatoryOff;

      if (!holidayForcedOff && !offAllowedByProfile) {
        throw new Error(`${employee.name} hanya bisa dijadwalkan libur pada hari yang diizinkan.`);
      }

      offCount += 1;
      return;
    }

    if (!GENERATOR_SHIFT_TYPES.includes(schedule.shift_type)) {
      throw new Error(`Shift ${schedule.shift_type} pada ${dateKey} tidak didukung pada jadwal mingguan.`);
    }

    if (!employee.allowedWorkingShiftTypes.includes(schedule.shift_type)) {
      throw new Error(`${employee.name} tidak diizinkan pada shift ${schedule.shift_type}.`);
    }

    shiftAssignments[schedule.shift_type].push(employeeId);
  });

  if (holidaySet.has(dateKey)) {
    const holidayMandatoryEmployees = activeEmployees.filter((employee) => employee.holidayMandatoryOff);

    if (holidayMandatoryEmployees.length) {
      const hasHolidayMandatoryOffEmployee = holidayMandatoryEmployees.some(
        (employee) => scheduleByEmployeeId.get(String(employee.id))?.shift_type === 'libur',
      );

      if (!hasHolidayMandatoryOffEmployee) {
        throw new Error(`Tanggal merah ${dateKey} harus meliburkan minimal 1 pegawai dari daftar Tgl Merah Wajib Libur.`);
      }
    }
  }

  if (offCount > getMaxOffCountForDate(dateKey, holidaySet)) {
    throw new Error(`Maksimal ${MAX_OFF_PER_DAY} pegawai libur pada hari biasa ${dateKey}.`);
  }

  if (!isShiftHeadcountBalanced(shiftAssignments.pagi.length, shiftAssignments.siang.length)) {
    throw new Error(`Jumlah pegawai shift pagi dan siang pada ${dateKey} harus seimbang. Selisih maksimal 1 orang.`);
  }

  for (const shiftType of GENERATOR_SHIFT_TYPES) {
    const shiftEmployeeIds = shiftAssignments[shiftType] || [];

    if (!shiftEmployeeIds.length) {
      throw new Error(`Shift ${shiftType} pada ${dateKey} belum memiliki pegawai.`);
    }

    const genderCount = getGenderCountForShift(shiftEmployeeIds, employeesById);

    if (!genderCount['laki-laki'] || !genderCount.perempuan) {
      throw new Error(`Shift ${shiftType} pada ${dateKey} harus memiliki pegawai laki-laki dan perempuan.`);
    }

    const roleCount = getRoleCountForShift(shiftEmployeeIds, employeesById);

    if (!roleCount.kasir) {
      throw new Error(`Shift ${shiftType} pada ${dateKey} harus memiliki kasir.`);
    }

    if (!roleCount.pimpinan_shift) {
      throw new Error(`Shift ${shiftType} pada ${dateKey} harus memiliki pimpinan shift.`);
    }

    const pairConflict = getSeparatedPairConflict(shiftEmployeeIds, separatedPairs, employeesById);

    if (pairConflict) {
      throw new Error(
        `${pairConflict.leftEmployeeName} dan ${pairConflict.rightEmployeeName} tidak boleh berada pada shift ${shiftType} di ${dateKey}.`,
      );
    }
  }

  const workingEmployees = activeEmployees.filter(
    (employee) => !scheduleByEmployeeId.has(String(employee.id)) || scheduleByEmployeeId.get(String(employee.id))?.shift_type !== 'libur',
  );

  if (!canWorkingEmployeesKeepShiftRoles(workingEmployees)) {
    throw new Error(`Pegawai kerja pada ${dateKey} harus tetap cukup untuk menjaga kebutuhan kasir dan pimpinan shift.`);
  }
}

function validateHolidayCompensationRules({ activeEmployees, holidaySet, schedulesByDate, weekDateKeys }) {
  if (!holidaySet.size) {
    return;
  }

  const offDatesByEmployeeId = new Map(activeEmployees.map((employee) => [String(employee.id), []]));

  weekDateKeys.forEach((dateKey) => {
    const schedulesForDate = schedulesByDate.get(dateKey) || [];

    schedulesForDate.forEach((schedule) => {
      if (schedule.shift_type !== 'libur') {
        return;
      }

      const employeeId = String(schedule.employee_id);

      if (!offDatesByEmployeeId.has(employeeId)) {
        return;
      }

      offDatesByEmployeeId.get(employeeId).push(dateKey);
    });
  });

  activeEmployees.forEach((employee) => {
    const offDates = offDatesByEmployeeId.get(String(employee.id)) || [];
    const holidayOffDates = offDates.filter((dateKey) => holidaySet.has(dateKey));

    if (!holidayOffDates.length) {
      return;
    }

    const nonHolidayOffDates = offDates.filter((dateKey) => !holidaySet.has(dateKey));

    if (!nonHolidayOffDates.length) {
      throw new Error(`${employee.name} libur di tanggal merah dan harus memiliki 1 hari libur tambahan pada minggu yang sama.`);
    }
  });
}

export function validateScheduleWeekRules({ employees, schedules, weekDateKeys, holidayDates = [] }) {
  const activeEmployees = prepareEmployees(employees);
  const employeesById = new Map(activeEmployees.map((employee) => [String(employee.id), employee]));
  const holidaySet = new Set(holidayDates);
  const schedulesByDate = new Map(weekDateKeys.map((dateKey) => [dateKey, []]));
  const separatedPairs = normalizeSeparatedPairs(activeEmployees);

  schedules.forEach((schedule) => {
    const dateKey = toDateKey(parseDateKey(schedule.date));

    if (!schedulesByDate.has(dateKey)) {
      return;
    }

    schedulesByDate.get(dateKey).push({
      ...schedule,
      date: dateKey,
    });
  });

  weekDateKeys.forEach((dateKey) => {
    validateScheduleDayRules({
      activeEmployees,
      dateKey,
      employeesById,
      schedulesForDate: schedulesByDate.get(dateKey) || [],
      holidaySet,
      separatedPairs,
    });
  });

  validateHolidayCompensationRules({
    activeEmployees,
    holidaySet,
    schedulesByDate,
    weekDateKeys,
  });
}

function prepareEmployees(employees, employeeRuleOverrides = []) {
  const ruleOverrideMap = new Map(
    (Array.isArray(employeeRuleOverrides) ? employeeRuleOverrides : [])
      .filter((rule) => rule?.employeeId)
      .map((rule) => [String(rule.employeeId), rule]),
  );

  return sortEmployees(
    employees
      .filter((employee) => ACTIVE_EMPLOYEE_STATUSES.includes(employee.status))
      .map((employee) => {
        const normalizedName = normalizeName(employee.name);
        const employeeWithMeta = {
          ...employee,
          normalizedName,
        };
        const ruleConfig = buildEmployeeRuleConfig(employeeWithMeta, ruleOverrideMap.get(String(employee.id)));

        return {
          ...employeeWithMeta,
          normalizedGender: normalizeGender(employee.gender),
          ...ruleConfig,
        };
      }),
  );
}

function assertEmployeeRulePreconditions(employees) {
  employees.forEach((employee) => {
    if (!employee.allowedWorkingShiftTypes || employee.allowedWorkingShiftTypes.length === 0) {
      throw new Error(`${employee.name} harus memiliki minimal 1 shift kerja yang diizinkan sebelum generate.`);
    }

    if (!employee.allowedOffWeekdays || employee.allowedOffWeekdays.length === 0) {
      throw new Error(`${employee.name} harus memiliki minimal 1 hari libur yang diizinkan sebelum generate.`);
    }
  });
}

function assertMonthlyGeneratorPreconditions(employees) {
  if (!employees.length) {
    throw new Error('Belum ada pegawai aktif untuk dibuatkan jadwal.');
  }

  const employeesWithUnknownGender = employees.filter((employee) => !employee.normalizedGender);

  if (employeesWithUnknownGender.length > 0) {
    throw new Error(`Gender pegawai berikut belum valid: ${employeesWithUnknownGender.map((employee) => employee.name).join(', ')}.`);
  }

  const genderCounts = countEmployeesByGender(employees);

  if (genderCounts['laki-laki'] < 3 || genderCounts.perempuan < 3) {
    throw new Error('Agar setiap shift selalu berisi cowo dan cewe, minimal dibutuhkan 3 pegawai laki-laki dan 3 pegawai perempuan aktif.');
  }

  const roleCounts = countEmployeesByRole(employees);

  if (roleCounts.kasir < 3) {
    throw new Error('Agar setiap shift selalu memiliki kasir, minimal dibutuhkan 3 pegawai aktif yang ditandai sebagai kasir.');
  }

  if (roleCounts.pimpinan_shift < 3) {
    throw new Error('Agar setiap shift selalu memiliki pimpinan shift, minimal dibutuhkan 3 pegawai aktif yang ditandai sebagai pimpinan shift.');
  }

  return genderCounts;
}

function buildHolidayCountByWeekday(dateKeys, holidaySet) {
  const holidayCountByWeekday = new Map(Array.from({ length: 7 }, (_, index) => [index, 0]));

  dateKeys.forEach((dateKey) => {
    if (!holidaySet.has(dateKey)) {
      return;
    }

    const dayIndex = getDayIndex(dateKey);
    holidayCountByWeekday.set(dayIndex, holidayCountByWeekday.get(dayIndex) + 1);
  });

  return holidayCountByWeekday;
}

function getWeekdayCandidates(employee, holidayCountByWeekday) {
  const baseCandidates = employee.allowedOffWeekdays?.length ? employee.allowedOffWeekdays : DEFAULT_ALLOWED_OFF_WEEKDAYS;

  return [...baseCandidates].sort((leftDay, rightDay) => {
    const holidayDiff = holidayCountByWeekday.get(leftDay) - holidayCountByWeekday.get(rightDay);

    if (holidayDiff !== 0) {
      return holidayDiff;
    }

    return PREFERRED_WEEKDAY_ORDER.indexOf(leftDay) - PREFERRED_WEEKDAY_ORDER.indexOf(rightDay);
  });
}

function canAssignEmployeeToWeekday(employee, weekday, weekdayAssignments, totalGenderCounts, context = {}) {
  const assignedEmployees = weekdayAssignments.get(weekday) || [];
  const dateKey = context.weekdayDateMap?.get(weekday);
  const fixedWorkingDates = context.fixedWorkingDatesByEmployee?.get(String(employee.id));

  if (assignedEmployees.some((assignedEmployee) => String(assignedEmployee.id) === String(employee.id))) {
    return false;
  }

  if (dateKey && fixedWorkingDates?.has(dateKey)) {
    return false;
  }

  const maxOffCount = dateKey ? getMaxOffCountForDate(dateKey, context.holidaySet) : MAX_OFF_PER_DAY;

  if (assignedEmployees.length >= maxOffCount) {
    return false;
  }

  return canOffCombinationKeepShiftGender([...assignedEmployees, employee], totalGenderCounts);
}

function buildPrimaryOffPlan(employees, dateKeys, weekdayAssignments) {
  const plan = {
    offByDate: new Map(),
    offEntriesByEmployee: new Map(employees.map((employee) => [employee.id, []])),
    holidaySet: new Set(),
  };

  dateKeys.forEach((dateKey) => {
    const offEmployees = weekdayAssignments.get(getDayIndex(dateKey)) || [];

    offEmployees.forEach((employee) => {
      addOffEntry(plan, dateKey, employee.id, 'weekly');
    });
  });

  return plan;
}

function hasMinimumGap(existingDateKeys, candidateDateKey) {
  return existingDateKeys.every((existingDateKey) => Math.abs(daysBetween(existingDateKey, candidateDateKey)) >= 3);
}

function canAddEmployeeOffOnDate({ employee, dateKey, plan, employeesById, totalGenderCounts }) {
  const offEmployees = getOffEntriesForDate(plan.offByDate, dateKey).map((entry) => employeesById.get(entry.employeeId));

  if (offEmployees.length >= getMaxOffCountForDate(dateKey, plan.holidaySet)) {
    return false;
  }

  if (offEmployees.some((offEmployee) => offEmployee.id === employee.id)) {
    return false;
  }

  return canOffCombinationKeepShiftGender([...offEmployees, employee], totalGenderCounts);
}

function getExtraOffCandidates({ request, weekDates, holidaySet, plan, employeesById, totalGenderCounts }) {
  const existingDateKeys = plan.offEntriesByEmployee.get(request.employee.id).map((entry) => entry.dateKey);

  return weekDates
    .filter((dateKey) => !holidaySet.has(dateKey))
    .filter((dateKey) => canUseHolidayExtraOffDate(request.employee, dateKey))
    .filter((dateKey) => hasMinimumGap(existingDateKeys, dateKey))
    .filter((dateKey) =>
      canAddEmployeeOffOnDate({
        employee: request.employee,
        dateKey,
        plan,
        employeesById,
        totalGenderCounts,
      }),
    )
    .sort((leftDateKey, rightDateKey) => {
      const leftIsWeekend = isWeekendDayIndex(getDayIndex(leftDateKey));
      const rightIsWeekend = isWeekendDayIndex(getDayIndex(rightDateKey));

      if (leftIsWeekend !== rightIsWeekend) {
        return leftIsWeekend ? -1 : 1;
      }

      const leftDistance = Math.abs(daysBetween(leftDateKey, request.primaryDate));
      const rightDistance = Math.abs(daysBetween(rightDateKey, request.primaryDate));

      if (leftDistance !== rightDistance) {
        return rightDistance - leftDistance;
      }

      return compareByDate(leftDateKey, rightDateKey);
    });
}

function applyHolidayMandatoryOffEntries({ employees, dateKeys, holidaySet, plan, totalGenderCounts }) {
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const employeesWithMandatoryHolidayOff = employees.filter((employee) => employee.holidayMandatoryOff);
  const holidayDateKeys = dateKeys.filter((dateKey) => holidaySet.has(dateKey));

  if (!holidayDateKeys.length || !employeesWithMandatoryHolidayOff.length) {
    return true;
  }

  function search(index) {
    if (index >= holidayDateKeys.length) {
      return true;
    }

    const dateKey = holidayDateKeys[index];
    const existingMandatoryOffEmployees = employeesWithMandatoryHolidayOff.filter((employee) =>
      getOffEntriesForDate(plan.offByDate, dateKey).some((entry) => entry.employeeId === employee.id),
    );

    if (existingMandatoryOffEmployees.length) {
      return search(index + 1);
    }

    const candidateEmployees = [...employeesWithMandatoryHolidayOff]
      .filter((employee) =>
        canAddEmployeeOffOnDate({
          employee,
          dateKey,
          plan,
          employeesById,
          totalGenderCounts,
        }),
      )
      .sort((leftEmployee, rightEmployee) => {
        const leftOffCount = (plan.offEntriesByEmployee.get(leftEmployee.id) || []).length;
        const rightOffCount = (plan.offEntriesByEmployee.get(rightEmployee.id) || []).length;

        if (leftOffCount !== rightOffCount) {
          return leftOffCount - rightOffCount;
        }

        return leftEmployee.name.localeCompare(rightEmployee.name);
      });

    if (!candidateEmployees.length) {
      return false;
    }

    for (const employee of candidateEmployees) {
      addOffEntry(plan, dateKey, employee.id, 'holiday-mandatory');

      if (search(index + 1)) {
        return true;
      }

      removeOffEntry(plan, dateKey, employee.id, 'holiday-mandatory');
    }

    return false;
  }

  return search(0);
}

function applyHolidayBridgeOffEntries({ employees, weekDates, plan, totalGenderCounts }) {
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const middleWeekDates = weekDates.slice(1, -1);
  let hasChanges = true;

  while (hasChanges) {
    hasChanges = false;

    for (const employee of employees) {
      if (!employee.holidayMandatoryOff) {
        continue;
      }

      const offDateSet = new Set((plan.offEntriesByEmployee.get(employee.id) || []).map((entry) => entry.dateKey));

      for (const dateKey of middleWeekDates) {
        if (offDateSet.has(dateKey)) {
          continue;
        }

        const previousDateKey = toDateKey(addDays(parseDateKey(dateKey), -1));
        const nextDateKey = toDateKey(addDays(parseDateKey(dateKey), 1));
        const canUseBridgeDate = canUseHolidayExtraOffDate(employee, dateKey);

        if (!offDateSet.has(previousDateKey) || !offDateSet.has(nextDateKey) || !canUseBridgeDate) {
          continue;
        }

        if (
          !canAddEmployeeOffOnDate({
            employee,
            dateKey,
            plan,
            employeesById,
            totalGenderCounts,
          })
        ) {
          return false;
        }

        addOffEntry(plan, dateKey, employee.id, 'holiday-bridge');
        offDateSet.add(dateKey);
        hasChanges = true;
      }
    }
  }

  return true;
}

function buildOffPlanWithHolidayCompensation(employees, dateKeys, holidaySet, weekdayAssignments, totalGenderCounts) {
  const primaryPlan = buildPrimaryOffPlan(employees, dateKeys, weekdayAssignments);
  primaryPlan.holidaySet = holidaySet;
  const weekBuckets = buildWeekBuckets(dateKeys);
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));

  if (!applyHolidayMandatoryOffEntries({ employees, dateKeys, holidaySet, plan: primaryPlan, totalGenderCounts })) {
    return null;
  }

  for (const week of weekBuckets) {
    if (!applyHolidayBridgeOffEntries({ employees, weekDates: week.dates, plan: primaryPlan, totalGenderCounts })) {
      return null;
    }

    const requests = week.dates.flatMap((dateKey) => {
      if (!holidaySet.has(dateKey)) {
        return [];
      }

      return getOffEntriesForDate(primaryPlan.offByDate, dateKey)
        .filter((entry) => entry.reason === 'weekly')
        .map((entry) => ({
          employee: employeesById.get(entry.employeeId),
          primaryDate: dateKey,
        }));
    });

    if (!requests.length) {
      continue;
    }

    const availableExtraSlots = week.dates
      .filter((dateKey) => !holidaySet.has(dateKey))
      .reduce(
        (total, dateKey) => total + Math.max(0, getMaxOffCountForDate(dateKey, holidaySet) - getOffEntriesForDate(primaryPlan.offByDate, dateKey).length),
        0,
      );

    if (availableExtraSlots < requests.length) {
      return null;
    }

    function assignExtraOffDates(pendingRequests) {
      if (!pendingRequests.length) {
        return true;
      }

      const [currentRequest] = [...pendingRequests]
        .map((request) => ({
          request,
          candidates: getExtraOffCandidates({
            request,
            weekDates: week.dates,
            holidaySet,
            plan: primaryPlan,
            employeesById,
            totalGenderCounts,
          }),
        }))
        .sort((left, right) => left.candidates.length - right.candidates.length);

      if (!currentRequest || !currentRequest.candidates.length) {
        return false;
      }

      const remainingRequests = pendingRequests.filter((request) => request !== currentRequest.request);

      for (const candidateDateKey of currentRequest.candidates) {
        addOffEntry(primaryPlan, candidateDateKey, currentRequest.request.employee.id, 'holiday-compensation');

        if (assignExtraOffDates(remainingRequests)) {
          return true;
        }

        removeOffEntry(primaryPlan, candidateDateKey, currentRequest.request.employee.id, 'holiday-compensation');
      }

      return false;
    }

    if (!assignExtraOffDates(requests)) {
      return null;
    }
  }

  const offDatesByEmployee = new Map(
    Array.from(primaryPlan.offEntriesByEmployee.entries()).map(([employeeId, entries]) => [
      employeeId,
      new Set(entries.map((entry) => entry.dateKey)),
    ]),
  );

  return {
    offByDate: primaryPlan.offByDate,
    offDatesByEmployee,
    holidaySet: primaryPlan.holidaySet,
  };
}

function getPersistedSeparatedPairs(employees) {
  const activeEmployeeIds = new Set(employees.map((employee) => String(employee.id)));
  const seenPairs = new Set();
  const persistedPairs = [];

  employees.forEach((employee) => {
    const employeeId = String(employee.id);
    const separatedEmployeeIds = Array.isArray(employee.separated_employee_ids)
      ? employee.separated_employee_ids.map((value) => String(value || '')).filter(Boolean)
      : [];

    separatedEmployeeIds.forEach((restrictedEmployeeId) => {
      if (restrictedEmployeeId === employeeId) {
        return;
      }

      if (!activeEmployeeIds.has(restrictedEmployeeId)) {
        return;
      }

      const pairKey = [employeeId, restrictedEmployeeId].sort().join(':');

      if (seenPairs.has(pairKey)) {
        return;
      }

      seenPairs.add(pairKey);
      persistedPairs.push(pairKey.split(':'));
    });
  });

  return persistedPairs;
}

function normalizeSeparatedPairs(employees, separatedPairs) {
  const activeEmployeeIds = new Set(employees.map((employee) => String(employee.id)));
  const normalizedPairs = [...getPersistedSeparatedPairs(employees)];
  const seenPairs = new Set(normalizedPairs.map((pair) => pair.join(':')));

  if (!Array.isArray(separatedPairs)) {
    return normalizedPairs;
  }

  separatedPairs.forEach((pair, index) => {
    const leftEmployeeId = String(pair?.leftEmployeeId || pair?.[0] || '');
    const rightEmployeeId = String(pair?.rightEmployeeId || pair?.[1] || '');

    if (!leftEmployeeId && !rightEmployeeId) {
      return;
    }

    if (!leftEmployeeId || !rightEmployeeId) {
      throw new Error(`Pasangan pegawai ke-${index + 1} belum lengkap.`);
    }

    if (leftEmployeeId === rightEmployeeId) {
      throw new Error('Pasangan pegawai yang dipisah harus terdiri dari dua pegawai yang berbeda.');
    }

    if (!activeEmployeeIds.has(leftEmployeeId) || !activeEmployeeIds.has(rightEmployeeId)) {
      throw new Error('Pasangan pegawai yang dipisah harus berasal dari pegawai aktif.');
    }

    const pairKey = [leftEmployeeId, rightEmployeeId].sort().join(':');

    if (seenPairs.has(pairKey)) {
      return;
    }

    seenPairs.add(pairKey);
    normalizedPairs.push(pairKey.split(':'));
  });

  return normalizedPairs;
}

function isEmployeeInSeparatedPair(employeeId, separatedPairs) {
  return separatedPairs.some(
    ([leftEmployeeId, rightEmployeeId]) => leftEmployeeId === employeeId || rightEmployeeId === employeeId,
  );
}

function buildExistingScheduleContext(dateKeys, employees, existingSchedules = [], holidaySet = new Set()) {
  const allowedDateKeys = new Set(dateKeys);
  const employeesById = new Map(employees.map((employee) => [String(employee.id), employee]));
  const weekdayDateMap = new Map(dateKeys.map((dateKey) => [getDayIndex(dateKey), dateKey]));
  const weekdayAssignments = new Map(Array.from({ length: 7 }, (_, weekday) => [weekday, []]));
  const fixedShiftAssignmentsByDate = new Map(dateKeys.map((dateKey) => [dateKey, new Map()]));
  const existingEmployeeIdsByDate = new Map(dateKeys.map((dateKey) => [dateKey, new Set()]));
  const fixedWorkingDatesByEmployee = new Map(employees.map((employee) => [String(employee.id), new Set()]));
  const employeesWithFixedOff = new Set();

  existingSchedules.forEach((schedule) => {
    const dateKey = toDateKey(parseDateKey(schedule.date));

    if (!allowedDateKeys.has(dateKey)) {
      return;
    }

    const employeeId = String(schedule.employee_id);
    const employee = employeesById.get(employeeId);

    if (!employee) {
      return;
    }

    existingEmployeeIdsByDate.get(dateKey).add(employeeId);

    if (schedule.shift_type === 'libur') {
      const weekday = getDayIndex(dateKey);
      const existingOffEmployees = weekdayAssignments.get(weekday);

      if (!existingOffEmployees.some((item) => String(item.id) === employeeId)) {
        existingOffEmployees.push(employee);
      }

      employeesWithFixedOff.add(employeeId);
      return;
    }

    fixedWorkingDatesByEmployee.get(employeeId).add(dateKey);
    fixedShiftAssignmentsByDate.get(dateKey).set(employeeId, schedule.shift_type);
  });

  dateKeys.forEach((dateKey) => {
    const fixedOffEmployees = weekdayAssignments.get(getDayIndex(dateKey)) || [];

    if (fixedOffEmployees.length > getMaxOffCountForDate(dateKey, holidaySet)) {
      throw new Error(
        `Jadwal yang sudah ada pada ${dateKey} memiliki lebih dari ${MAX_OFF_PER_DAY} pegawai libur pada hari biasa, jadi generator tidak bisa melanjutkan.`,
      );
    }
  });

  return {
    weekdayDateMap,
    weekdayAssignments,
    fixedShiftAssignmentsByDate,
    existingEmployeeIdsByDate,
    fixedWorkingDatesByEmployee,
    employeesWithFixedOff,
  };
}

function buildAllowedShiftMap(workingEmployees, dateKey, offDatesByEmployee, fixedShiftAssignments = new Map()) {
  const previousDateKey = toDateKey(addDays(parseDateKey(dateKey), -1));
  const nextDateKey = toDateKey(addDays(parseDateKey(dateKey), 1));
  const allowedShiftMap = new Map();

  for (const employee of workingEmployees) {
    const fixedShiftType = fixedShiftAssignments.get(String(employee.id));

    if (fixedShiftType) {
      allowedShiftMap.set(employee.id, [fixedShiftType]);
      continue;
    }

    const employeeOffDates = offDatesByEmployee.get(employee.id) || new Set();
    const afterOff = employeeOffDates.has(previousDateKey);
    const beforeOff = employeeOffDates.has(nextDateKey);

    if (afterOff && beforeOff) {
      return null;
    }

    const baseAllowedShiftTypes = employee.allowedWorkingShiftTypes?.length
      ? employee.allowedWorkingShiftTypes
      : GENERATOR_SHIFT_TYPES;
    const preferredShiftTypes = beforeOff ? ['pagi'] : afterOff ? ['siang'] : null;
    let nextAllowedShiftTypes = preferredShiftTypes
      ? baseAllowedShiftTypes.filter((shiftType) => preferredShiftTypes.includes(shiftType))
      : [...baseAllowedShiftTypes];

    if (!nextAllowedShiftTypes.length) {
      nextAllowedShiftTypes = [...baseAllowedShiftTypes];
    }

    if (!nextAllowedShiftTypes.length) {
      return null;
    }

    allowedShiftMap.set(employee.id, nextAllowedShiftTypes);
  }

  return allowedShiftMap;
}

function getGenderCountForShift(assignedEmployees, employeesById) {
  return assignedEmployees.reduce(
    (accumulator, employeeId) => {
      const employee = employeesById.get(employeeId);
      accumulator[employee.normalizedGender] += 1;
      return accumulator;
    },
    {
      'laki-laki': 0,
      perempuan: 0,
    },
  );
}

function getRoleCountForShift(assignedEmployees, employeesById) {
  return assignedEmployees.reduce(
    (accumulator, employeeId) => {
      const employee = employeesById.get(employeeId);

      if (employee?.kasir) {
        accumulator.kasir += 1;
      }

      if (employee?.pimpinan_shift) {
        accumulator.pimpinan_shift += 1;
      }

      return accumulator;
    },
    {
      kasir: 0,
      pimpinan_shift: 0,
    },
  );
}

function isShiftHeadcountBalanced(pagiCount, siangCount) {
  return Math.abs(pagiCount - siangCount) <= 1;
}

function enumerateValidAssignments({ workingEmployees, allowedShiftMap, separatedPairs, fixedAssignments = new Map() }) {
  const employeesById = new Map(workingEmployees.map((employee) => [String(employee.id), employee]));
  const normalizedFixedAssignments = new Map(
    Array.from(fixedAssignments.entries()).map(([employeeId, shiftType]) => [String(employeeId), shiftType]),
  );
  const hasFixedPairConflict = separatedPairs.some(([leftEmployeeId, rightEmployeeId]) => {
    const leftShiftType = normalizedFixedAssignments.get(String(leftEmployeeId));
    return leftShiftType && leftShiftType === normalizedFixedAssignments.get(String(rightEmployeeId));
  });

  if (hasFixedPairConflict) {
    return [];
  }

  const orderedEmployees = [...workingEmployees]
    .filter((employee) => !normalizedFixedAssignments.has(String(employee.id)))
    .sort((left, right) => {
      const leftOptions = (allowedShiftMap.get(left.id) || []).length;
      const rightOptions = (allowedShiftMap.get(right.id) || []).length;

      if (leftOptions !== rightOptions) {
        return leftOptions - rightOptions;
      }

      const leftPriority = isEmployeeInSeparatedPair(left.id, separatedPairs) ? 0 : 1;
      const rightPriority = isEmployeeInSeparatedPair(right.id, separatedPairs) ? 0 : 1;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.name.localeCompare(right.name);
    });

  const validAssignments = [];
  const currentAssignment = new Map(normalizedFixedAssignments);

  function recurse(index) {
    if (index >= orderedEmployees.length) {
      const pagiEmployees = Array.from(currentAssignment.entries())
        .filter(([, shiftType]) => shiftType === 'pagi')
        .map(([employeeId]) => employeeId);
      const siangEmployees = Array.from(currentAssignment.entries())
        .filter(([, shiftType]) => shiftType === 'siang')
        .map(([employeeId]) => employeeId);

      if (!pagiEmployees.length || !siangEmployees.length) {
        return;
      }

      if (!isShiftHeadcountBalanced(pagiEmployees.length, siangEmployees.length)) {
        return;
      }

      const pagiGenderCount = getGenderCountForShift(pagiEmployees, employeesById);
      const siangGenderCount = getGenderCountForShift(siangEmployees, employeesById);

      if (!pagiGenderCount['laki-laki'] || !pagiGenderCount.perempuan) {
        return;
      }

      if (!siangGenderCount['laki-laki'] || !siangGenderCount.perempuan) {
        return;
      }

      const pagiRoleCount = getRoleCountForShift(pagiEmployees, employeesById);
      const siangRoleCount = getRoleCountForShift(siangEmployees, employeesById);

      if (!pagiRoleCount.kasir || !pagiRoleCount.pimpinan_shift) {
        return;
      }

      if (!siangRoleCount.kasir || !siangRoleCount.pimpinan_shift) {
        return;
      }

      validAssignments.push(new Map(currentAssignment));
      return;
    }

    const employee = orderedEmployees[index];
    const options = allowedShiftMap.get(employee.id) || [];

    for (const shiftType of options) {
      const hasPairConflict = separatedPairs.some(([leftEmployeeId, rightEmployeeId]) => {
        if (String(leftEmployeeId) === String(employee.id)) {
          return currentAssignment.get(String(rightEmployeeId)) === shiftType;
        }

        if (String(rightEmployeeId) === String(employee.id)) {
          return currentAssignment.get(String(leftEmployeeId)) === shiftType;
        }

        return false;
      });

      if (hasPairConflict) {
        continue;
      }

      currentAssignment.set(String(employee.id), shiftType);
      recurse(index + 1);
      currentAssignment.delete(String(employee.id));
    }
  }

  recurse(0);
  return validAssignments;
}

function selectBestAssignment(validAssignments, shiftStatsByEmployee) {
  let bestAssignment = null;
  let bestScore = Number.POSITIVE_INFINITY;

  validAssignments.forEach((assignment) => {
    const shiftCounts = {
      pagi: 0,
      siang: 0,
    };

    let score = 0;

    assignment.forEach((shiftType, employeeId) => {
      if (shiftType !== 'pagi' && shiftType !== 'siang') {
        return;
      }

      shiftCounts[shiftType] += 1;

      const currentStats = shiftStatsByEmployee.get(String(employeeId)) || { pagi: 0, siang: 0 };
      const nextPagiCount = currentStats.pagi + (shiftType === 'pagi' ? 1 : 0);
      const nextSiangCount = currentStats.siang + (shiftType === 'siang' ? 1 : 0);
      score += Math.abs(nextPagiCount - nextSiangCount);
    });

    score += Math.abs(shiftCounts.pagi - shiftCounts.siang) * 3;

    if (score < bestScore) {
      bestScore = score;
      bestAssignment = assignment;
    }
  });

  return bestAssignment;
}

function buildMonthlySchedulesFromOffPlan({
  employees,
  dateKeys,
  offPlan,
  createdBy,
  separatedPairs = [],
  existingScheduleContext = null,
}) {
  const shiftStatsByEmployee = new Map(employees.map((employee) => [String(employee.id), { pagi: 0, siang: 0 }]));
  const generatedSchedules = [];

  for (const dateKey of dateKeys) {
    const offEntries = getOffEntriesForDate(offPlan.offByDate, dateKey);

    if (offEntries.length > getMaxOffCountForDate(dateKey, offPlan.holidaySet)) {
      return null;
    }

    const existingEmployeeIds = existingScheduleContext?.existingEmployeeIdsByDate.get(dateKey) || new Set();
    const fixedShiftAssignments = existingScheduleContext?.fixedShiftAssignmentsByDate.get(dateKey) || new Map();
    const offEmployeeIds = new Set(offEntries.map((entry) => String(entry.employeeId)));
    const workingEmployees = employees.filter((employee) => !offEmployeeIds.has(String(employee.id)));
    const genderCounts = countEmployeesByGender(workingEmployees);

    if (
      genderCounts['laki-laki'] < MIN_WORKING_PER_GENDER_PER_DAY ||
      genderCounts.perempuan < MIN_WORKING_PER_GENDER_PER_DAY
    ) {
      return null;
    }

    if (!canWorkingEmployeesKeepShiftRoles(workingEmployees)) {
      return null;
    }

    const allowedShiftMap = buildAllowedShiftMap(workingEmployees, dateKey, offPlan.offDatesByEmployee, fixedShiftAssignments);

    if (!allowedShiftMap) {
      return null;
    }

    const validAssignments = enumerateValidAssignments({
      workingEmployees,
      allowedShiftMap,
      separatedPairs,
      fixedAssignments: fixedShiftAssignments,
    });

    if (!validAssignments.length) {
      return null;
    }

    const selectedAssignment = selectBestAssignment(validAssignments, shiftStatsByEmployee);

    if (!selectedAssignment) {
      return null;
    }

    offEntries.forEach((offEntry) => {
      if (existingEmployeeIds.has(String(offEntry.employeeId))) {
        return;
      }

      generatedSchedules.push({
        date: dateKey,
        employee_id: offEntry.employeeId,
        shift_type: 'libur',
        start_time: null,
        end_time: null,
        notes:
          offEntry.reason === 'holiday-compensation'
            ? 'Libur tambahan karena libur jatuh di tanggal merah.'
            : offEntry.reason === 'holiday-bridge'
              ? 'Libur tambahan untuk menjaga jeda libur tanggal merah.'
              : 'Libur mingguan otomatis.',
        created_by: createdBy,
      });
    });

    selectedAssignment.forEach((shiftType, employeeId) => {
      if (!existingEmployeeIds.has(String(employeeId))) {
        const hours = SHIFT_HOURS[shiftType] || { start: null, end: null };

        generatedSchedules.push({
          date: dateKey,
          employee_id: employeeId,
          shift_type: shiftType,
          start_time: hours.start || null,
          end_time: hours.end || null,
          notes: null,
          created_by: createdBy,
        });
      }

      if (shiftType === 'pagi' || shiftType === 'siang') {
        const employeeStats = shiftStatsByEmployee.get(String(employeeId));

        if (employeeStats) {
          employeeStats[shiftType] += 1;
        }
      }
    });
  }

  return generatedSchedules.sort((left, right) => {
    if (left.date !== right.date) {
      return compareByDate(left.date, right.date);
    }

    if (left.shift_type === right.shift_type) {
      return String(left.employee_id).localeCompare(String(right.employee_id));
    }

    return left.shift_type.localeCompare(right.shift_type);
  });
}

function resolveGeneratorRuleSet(employees, ruleOverrides = {}) {
  const activeEmployees = prepareEmployees(employees, ruleOverrides.employeeRules);
  assertEmployeeRulePreconditions(activeEmployees);

  return {
    activeEmployees,
    separatedPairs: normalizeSeparatedPairs(activeEmployees, ruleOverrides.separatedPairs),
  };
}

export function buildScheduleRuleDraft(employees, currentDraft = null) {
  const activeEmployees = prepareEmployees(employees, currentDraft?.employeeRules);
  const separatedPairs = normalizeSeparatedPairs(activeEmployees, currentDraft?.separatedPairs);

  return {
    employeeRules: activeEmployees.map((employee) => ({
      employeeId: employee.id,
      allowedWorkingShiftTypes: [...employee.allowedWorkingShiftTypes],
      allowedOffWeekdays: [...employee.allowedOffWeekdays],
    })),
    separatedPairs: separatedPairs.map(([leftEmployeeId, rightEmployeeId]) => ({
      leftEmployeeId,
      rightEmployeeId,
    })),
  };
}
export function getMonthDateRange(monthValue) {

  const monthMeta = getMonthMeta(monthValue);

  return {
    startDate: monthMeta.startDate,
    endDate: monthMeta.endDate,
  };
}

export function getWeekDateRange(dateValue) {
  const weekMeta = getWeekMeta(dateValue);

  return {
    startDate: weekMeta.startDate,
    endDate: weekMeta.endDate,
    dateKeys: weekMeta.dateKeys,
  };
}

function resolveHolidayPeriod(periodValue) {
  if (typeof periodValue === 'string') {
    const monthMeta = getMonthMeta(periodValue);
    return {
      startDate: monthMeta.startDate,
      endDate: monthMeta.endDate,
      rangeLabel: 'bulan yang sama dengan periode generate',
    };
  }

  if (periodValue?.startDate && periodValue?.endDate) {
    return {
      startDate: periodValue.startDate,
      endDate: periodValue.endDate,
      rangeLabel: 'minggu yang dipilih untuk generate',
    };
  }

  throw new Error('Periode tanggal merah tidak valid.');
}

function parseHolidayToken(token) {
  const trimmedToken = String(token).trim();
  const [dateToken, ...descriptionParts] = trimmedToken.split('|');

  return {
    dateToken: String(dateToken || '').trim(),
    description: descriptionParts.join('|').trim(),
  };
}

export function parseHolidayEntryInput(inputValue = '', periodValue) {
  const { startDate, endDate, rangeLabel } = resolveHolidayPeriod(periodValue);
  const rawTokens = String(inputValue)
    .split(/[\n,]/)
    .map((token) => token.trim())
    .filter(Boolean);
  const holidayEntriesByDate = new Map();

  rawTokens.forEach((token) => {
    const { dateToken, description } = parseHolidayToken(token);
    const parsedDate = parseDateKey(dateToken);
    const normalizedDateKey = toDateKey(parsedDate);

    if (normalizedDateKey < startDate || normalizedDateKey > endDate) {
      throw new Error(`Semua tanggal merah harus berada di ${rangeLabel}.`);
    }

    const previousEntry = holidayEntriesByDate.get(normalizedDateKey);
    holidayEntriesByDate.set(normalizedDateKey, {
      date: normalizedDateKey,
      description: description || previousEntry?.description || '',
    });
  });

  return Array.from(holidayEntriesByDate.values()).sort((leftEntry, rightEntry) =>
    compareByDate(leftEntry.date, rightEntry.date),
  );
}

export function parseHolidayDateInput(inputValue = '', periodValue) {
  return parseHolidayEntryInput(inputValue, periodValue).map((entry) => entry.date);
}

export function generateMonthlySchedules({ month, employees, existingSchedules = [], createdBy, holidayDates = [], ruleOverrides = {} }) {
  if (existingSchedules.length > 0) {
    throw new Error('Bulan yang dipilih sudah memiliki jadwal. Hapus jadwal bulan ini terlebih dahulu agar generator bisa menjaga semua aturan dengan konsisten.');
  }

  const monthMeta = getMonthMeta(month);
  const holidaySet = new Set(holidayDates);
  const { activeEmployees, separatedPairs } = resolveGeneratorRuleSet(employees, ruleOverrides);
  const totalGenderCounts = assertMonthlyGeneratorPreconditions(activeEmployees);
  const holidayCountByWeekday = buildHolidayCountByWeekday(monthMeta.dateKeys, holidaySet);
  const orderedEmployees = [...activeEmployees].sort((left, right) => {
    const leftCandidateCount = getWeekdayCandidates(left, holidayCountByWeekday).length;
    const rightCandidateCount = getWeekdayCandidates(right, holidayCountByWeekday).length;

    if (leftCandidateCount !== rightCandidateCount) {
      return leftCandidateCount - rightCandidateCount;
    }

    return left.name.localeCompare(right.name);
  });
  const weekdayAssignments = new Map(Array.from({ length: 7 }, (_, weekday) => [weekday, []]));

  function search(index) {
    if (index >= orderedEmployees.length) {
      const offPlan = buildOffPlanWithHolidayCompensation(
        activeEmployees,
        monthMeta.dateKeys,
        holidaySet,
        weekdayAssignments,
        totalGenderCounts,
      );

      if (!offPlan) {
        return null;
      }

      return buildMonthlySchedulesFromOffPlan({
        employees: activeEmployees,
        dateKeys: monthMeta.dateKeys,
        offPlan,
        createdBy,
        separatedPairs,
      });
    }

    const employee = orderedEmployees[index];
    const weekdayCandidates = getWeekdayCandidates(employee, holidayCountByWeekday)
      .filter((weekday) => canAssignEmployeeToWeekday(employee, weekday, weekdayAssignments, totalGenderCounts))
      .sort((leftWeekday, rightWeekday) => {
        const loadDiff = weekdayAssignments.get(leftWeekday).length - weekdayAssignments.get(rightWeekday).length;

        if (loadDiff !== 0) {
          return loadDiff;
        }

        return holidayCountByWeekday.get(leftWeekday) - holidayCountByWeekday.get(rightWeekday);
      });

    for (const weekday of weekdayCandidates) {
      weekdayAssignments.get(weekday).push(employee);

      const result = search(index + 1);

      if (result) {
        return result;
      }

      weekdayAssignments.get(weekday).pop();
    }

    return null;
  }

  const generatedSchedules = search(0);

  if (!generatedSchedules || !generatedSchedules.length) {
    throw new Error('Generator tidak menemukan kombinasi jadwal yang memenuhi seluruh aturan shift, libur, gender, dan tanggal merah pada bulan ini.');
  }

  return generatedSchedules;
}

export function generateWeeklySchedules({ date, employees, existingSchedules = [], createdBy, holidayDates = [], ruleOverrides = {} }) {
  const weekMeta = getWeekMeta(date);
  const holidaySet = new Set(holidayDates);
  const { activeEmployees, separatedPairs } = resolveGeneratorRuleSet(employees, ruleOverrides);
  const totalGenderCounts = assertMonthlyGeneratorPreconditions(activeEmployees);
  const existingScheduleContext = buildExistingScheduleContext(weekMeta.dateKeys, activeEmployees, existingSchedules, holidaySet);
  const holidayCountByWeekday = buildHolidayCountByWeekday(weekMeta.dateKeys, holidaySet);
  const orderedEmployees = [...activeEmployees]
    .filter((employee) => !existingScheduleContext.employeesWithFixedOff.has(String(employee.id)))
    .sort((left, right) => {
      const leftCandidateCount = getWeekdayCandidates(left, holidayCountByWeekday).length;
      const rightCandidateCount = getWeekdayCandidates(right, holidayCountByWeekday).length;

      if (leftCandidateCount !== rightCandidateCount) {
        return leftCandidateCount - rightCandidateCount;
      }

      return left.name.localeCompare(right.name);
    });
  const weekdayAssignments = new Map(
    Array.from(existingScheduleContext.weekdayAssignments.entries()).map(([weekday, assignedEmployees]) => [
      weekday,
      [...assignedEmployees],
    ]),
  );

  function search(index) {
    if (index >= orderedEmployees.length) {
      const offPlan = buildOffPlanWithHolidayCompensation(
        activeEmployees,
        weekMeta.dateKeys,
        holidaySet,
        weekdayAssignments,
        totalGenderCounts,
      );

      if (!offPlan) {
        return null;
      }

      return buildMonthlySchedulesFromOffPlan({
        employees: activeEmployees,
        dateKeys: weekMeta.dateKeys,
        offPlan,
        createdBy,
        separatedPairs,
        existingScheduleContext,
      });
    }

    const employee = orderedEmployees[index];
    const weekdayCandidates = getWeekdayCandidates(employee, holidayCountByWeekday)
      .filter((weekday) =>
        canAssignEmployeeToWeekday(employee, weekday, weekdayAssignments, totalGenderCounts, existingScheduleContext),
      )
      .sort((leftWeekday, rightWeekday) => {
        const loadDiff = weekdayAssignments.get(leftWeekday).length - weekdayAssignments.get(rightWeekday).length;

        if (loadDiff !== 0) {
          return loadDiff;
        }

        return holidayCountByWeekday.get(leftWeekday) - holidayCountByWeekday.get(rightWeekday);
      });

    for (const weekday of weekdayCandidates) {
      weekdayAssignments.get(weekday).push(employee);

      const result = search(index + 1);

      if (result) {
        return result;
      }

      weekdayAssignments.get(weekday).pop();
    }

    return null;
  }

  const generatedSchedules = search(0);

  if (!generatedSchedules) {
    throw new Error(
      existingSchedules.length > 0
        ? 'Generator tidak menemukan kombinasi jadwal yang memenuhi seluruh aturan minggu ini. Periksa jadwal yang sudah ada karena bisa jadi bertabrakan dengan rule shift, kasir, pimpinan shift, atau libur mingguan.'
        : 'Generator tidak menemukan kombinasi jadwal yang memenuhi seluruh aturan shift, libur, gender, kasir, pimpinan shift, dan tanggal merah pada minggu ini.',
    );
  }

  if (!generatedSchedules.length) {
    throw new Error('Minggu yang dipilih sudah memiliki jadwal lengkap, jadi tidak ada slot kosong yang perlu digenerate.');
  }

  return generatedSchedules;
}

export function generateRoundRobinSchedules({ date, employees, existingSchedules = [], createdBy }) {
  const blockedEmployeeIds = new Set(existingSchedules.map((item) => item.employee_id));
  const safeEmployees = employees
    .filter((employee) => ACTIVE_EMPLOYEE_STATUSES.includes(employee.status))
    .filter((employee) => !blockedEmployeeIds.has(employee.id))
    .sort((left, right) => {
      const hierarchyDiff = (left.hierarchy_order || 0) - (right.hierarchy_order || 0);

      if (hierarchyDiff !== 0) {
        return hierarchyDiff;
      }

      return left.name.localeCompare(right.name);
    });

  const daySeed = new Date(date).getDate() % shiftSequence.length;

  return safeEmployees.map((employee, index) => {
    const shiftType = shiftSequence[(index + daySeed) % shiftSequence.length];
    const hours = SHIFT_HOURS[shiftType];

    return {
      date,
      employee_id: employee.id,
      shift_type: shiftType,
      start_time: hours.start || null,
      end_time: hours.end || null,
      notes: shiftType === 'libur' ? 'Generated by round-robin' : null,
      created_by: createdBy,
    };
  });
}





