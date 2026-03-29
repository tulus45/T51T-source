import { ChevronLeft, ChevronRight, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import ScheduleGeneratorModal from '../components/schedules/MonthlyScheduleGeneratorModal';
import ScheduleFormModal from '../components/schedules/ScheduleFormModal';
import ScheduleWeekView from '../components/schedules/ScheduleWeekView';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import DatePickerInput from '../components/ui/DatePickerInput';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { listEmployees } from '../services/employeesService';
import {
  bulkCreateSchedules,
  deleteSchedules,
  deleteSchedulesByIds,
  listSchedules,
  upsertSchedules,
} from '../services/schedulesService';
import { formatDate } from '../utils/formatters';
import { assertPermission } from '../utils/permissions';
import {
  generateWeeklySchedules,
  getWeekDateRange,
  parseHolidayEntryInput,
  validateScheduleRuleForEntry,
  validateScheduleWeekRules,
} from '../utils/schedule';

const HOLIDAY_STORAGE_KEY = 'schedule-holiday-entries';
const DEFAULT_PUBLIC_HOLIDAY_ENTRIES = [
  { date: '2026-01-01', description: 'Tahun Baru 2026 Masehi' },
  { date: '2026-01-16', description: 'Isra Mikraj Nabi Muhammad SAW' },
  { date: '2026-02-17', description: 'Tahun Baru Imlek 2577 Kongzili' },
  { date: '2026-03-19', description: 'Hari Suci Nyepi (Tahun Baru Saka 1948)' },
  { date: '2026-03-21', description: 'Hari Raya Idul Fitri 1447 H' },
  { date: '2026-03-22', description: 'Hari Raya Idul Fitri 1447 H' },
  { date: '2026-04-03', description: 'Wafat Yesus Kristus' },
  { date: '2026-04-05', description: 'Hari Kebangkitan Yesus Kristus (Paskah)' },
  { date: '2026-05-01', description: 'Hari Buruh Internasional' },
  { date: '2026-05-14', description: 'Kenaikan Yesus Kristus' },
  { date: '2026-05-27', description: 'Hari Raya Idul Adha 1447 H' },
  { date: '2026-05-31', description: 'Hari Raya Waisak 2570 BE' },
  { date: '2026-06-01', description: 'Hari Lahir Pancasila' },
  { date: '2026-06-16', description: '1 Muharam 1448 H' },
  { date: '2026-08-17', description: 'Hari Proklamasi Kemerdekaan' },
  { date: '2026-08-25', description: 'Maulid Nabi Muhammad SAW' },
  { date: '2026-12-25', description: 'Kelahiran Yesus Kristus' },
];

const DEFAULT_PUBLIC_HOLIDAY_ENTRIES_BY_DATE = Object.fromEntries(
  DEFAULT_PUBLIC_HOLIDAY_ENTRIES.map((entry) => [entry.date, entry]),
);

function shiftDateByDays(dateValue, amount) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function getEmployeeRowPriority(employee) {
  if (employee.pimpinan_shift) {
    return 0;
  }

  if (employee.kasir) {
    return 1;
  }

  return 2;
}

function sortEmployeesForWeekView(left, right) {
  const roleDiff = getEmployeeRowPriority(left) - getEmployeeRowPriority(right);

  if (roleDiff !== 0) {
    return roleDiff;
  }

  const hierarchyDiff = (left.hierarchy_order || 999) - (right.hierarchy_order || 999);

  if (hierarchyDiff !== 0) {
    return hierarchyDiff;
  }

  return left.name.localeCompare(right.name);
}

function buildWeekRows(dateKeys, employeeRows, scheduleRows) {
  const scheduleMap = new Map(scheduleRows.map((item) => [String(item.employee_id) + ':' + item.date, item]));
  const visibleEmployees = employeeRows.filter((employee) => employee.status === 'aktif').sort(sortEmployeesForWeekView);

  return visibleEmployees.map((employee) => ({
    employee,
    itemsByDate: Object.fromEntries(
      dateKeys.map((dateKey) => [dateKey, scheduleMap.get(String(employee.id) + ':' + dateKey) || null]),
    ),
  }));
}

function isSameWeek(leftDate, rightDate) {
  return getWeekDateRange(leftDate).startDate === getWeekDateRange(rightDate).startDate;
}

function normalizeStoredHolidayEntries(rawValue) {
  if (!rawValue || typeof rawValue !== 'object') {
    return {};
  }

  return Object.entries(rawValue).reduce((accumulator, [dateKey, entry]) => {
    if (!dateKey) {
      return accumulator;
    }

    if (typeof entry === 'string') {
      accumulator[dateKey] = {
        date: dateKey,
        description: entry.trim(),
      };
      return accumulator;
    }

    accumulator[dateKey] = {
      date: entry?.date || dateKey,
      description: String(entry?.description || '').trim(),
    };
    return accumulator;
  }, {});
}

function loadHolidayEntriesByDate() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const storedValue = window.localStorage.getItem(HOLIDAY_STORAGE_KEY);
    return normalizeStoredHolidayEntries(storedValue ? JSON.parse(storedValue) : {});
  } catch {
    return {};
  }
}

function buildHolidayInputValue(holidayEntries = []) {
  return holidayEntries
    .map((entry) => (entry.description ? `${entry.date} | ${entry.description}` : entry.date))
    .join('\n');
}

function getHolidayEntriesForDateKeys(holidayEntriesByDate, dateKeys = []) {
  return dateKeys.map((dateKey) => holidayEntriesByDate[dateKey]).filter(Boolean);
}

function getResolvedHolidayEntriesByDate(customEntriesByDate) {
  return {
    ...DEFAULT_PUBLIC_HOLIDAY_ENTRIES_BY_DATE,
    ...customEntriesByDate,
  };
}

function mergeHolidayEntriesForWeek(currentEntriesByDate, weekDateKeys, holidayEntries) {
  const nextEntriesByDate = { ...currentEntriesByDate };

  weekDateKeys.forEach((dateKey) => {
    delete nextEntriesByDate[dateKey];
  });

  holidayEntries.forEach((entry) => {
    nextEntriesByDate[entry.date] = {
      date: entry.date,
      description: String(entry.description || '').trim(),
    };
  });

  return nextEntriesByDate;
}

function buildScheduleUniqueKey(schedule) {
  return `${schedule.date}:${schedule.employee_id}`;
}

function normalizeScheduleForPersistence(schedule, userId) {
  return {
    date: schedule.date,
    employee_id: schedule.employee_id,
    shift_type: schedule.shift_type,
    start_time: schedule.shift_type === 'libur' ? null : schedule.start_time || null,
    end_time: schedule.shift_type === 'libur' ? null : schedule.end_time || null,
    notes: schedule.notes || null,
    created_by: schedule.created_by || userId,
  };
}

function areSchedulesEquivalent(leftSchedule, rightSchedule) {
  if (!leftSchedule || !rightSchedule) {
    return false;
  }

  return (
    leftSchedule.date === rightSchedule.date &&
    String(leftSchedule.employee_id) === String(rightSchedule.employee_id) &&
    leftSchedule.shift_type === rightSchedule.shift_type &&
    (leftSchedule.start_time || null) === (rightSchedule.start_time || null) &&
    (leftSchedule.end_time || null) === (rightSchedule.end_time || null) &&
    (leftSchedule.notes || null) === (rightSchedule.notes || null)
  );
}

function applyPendingScheduleChanges(baseSchedules, pendingChanges, employeesById) {
  const scheduleMap = new Map(
    baseSchedules.map((schedule) => [
      String(schedule.id),
      {
        ...schedule,
        employee: employeesById.get(String(schedule.employee_id)) || schedule.employee || null,
        isPending: false,
      },
    ]),
  );

  Object.entries(pendingChanges).forEach(([scheduleId, change]) => {
    if (!change) {
      return;
    }

    if (change.type === 'delete') {
      scheduleMap.delete(String(scheduleId));
      return;
    }

    const currentSchedule = scheduleMap.get(String(scheduleId)) || {};
    const nextSchedule = {
      ...currentSchedule,
      ...change.schedule,
      id: currentSchedule.id || change.schedule.id,
      employee: employeesById.get(String(change.schedule.employee_id)) || change.schedule.employee || null,
      isPending: true,
    };

    scheduleMap.set(String(scheduleId), nextSchedule);
  });

  return Array.from(scheduleMap.values()).sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    const pendingDiff = Number(Boolean(left.isPending)) - Number(Boolean(right.isPending));

    if (pendingDiff !== 0) {
      return pendingDiff;
    }

    const leftStartTime = left.start_time || '';
    const rightStartTime = right.start_time || '';

    if (leftStartTime !== rightStartTime) {
      return leftStartTime.localeCompare(rightStartTime);
    }

    return String(left.employee_id).localeCompare(String(right.employee_id));
  });
}

function isDateWithinWeek(dateValue, weekRange) {
  return dateValue >= weekRange.startDate && dateValue <= weekRange.endDate;
}

function SchedulesPage() {
  const { user } = useAuth();
  const { canManageSchedules, isReadonly } = usePermissions();
  const { showToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [holidayEntriesByDate, setHolidayEntriesByDate] = useState(() => loadHolidayEntriesByDate());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isResetWeekOpen, setIsResetWeekOpen] = useState(false);
  const [pendingScheduleChanges, setPendingScheduleChanges] = useState({});
  const [generatorDraft, setGeneratorDraft] = useState({
    date: new Date().toISOString().slice(0, 10),
    holidayDates: '',
  });
  const [filters, setFilters] = useState({
    date: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(HOLIDAY_STORAGE_KEY, JSON.stringify(holidayEntriesByDate));
  }, [holidayEntriesByDate]);

  async function loadSchedulePage(nextFilters = filters) {
    try {
      setLoading(true);
      const weekRange = getWeekDateRange(nextFilters.date);
      const [employeeRows, scheduleRows] = await Promise.all([
        listEmployees(),
        listSchedules({
          dateFrom: weekRange.startDate,
          dateTo: weekRange.endDate,
        }),
      ]);

      setEmployees(employeeRows);
      setSchedules(scheduleRows);
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Jadwal gagal dimuat',
        message: error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSchedulePage(filters);
  }, [filters.date]);

  useEffect(() => {
    if (!isReadonly) {
      return;
    }

    const todayDate = new Date().toISOString().slice(0, 10);

    if (!isSameWeek(filters.date, todayDate)) {
      setFilters((current) => ({
        ...current,
        date: getWeekDateRange(todayDate).startDate,
      }));
    }
  }, [filters.date, isReadonly]);

  const selectedWeek = getWeekDateRange(filters.date);
  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [String(employee.id), employee])),
    [employees],
  );
  const resolvedHolidayEntriesByDate = getResolvedHolidayEntriesByDate(holidayEntriesByDate);
  const selectedWeekHolidayEntries = getHolidayEntriesForDateKeys(resolvedHolidayEntriesByDate, selectedWeek.dateKeys);
  const displayedSchedules = useMemo(
    () => applyPendingScheduleChanges(schedules, pendingScheduleChanges, employeesById),
    [employeesById, pendingScheduleChanges, schedules],
  );
  const weekLabel = `${formatDate(selectedWeek.startDate)} - ${formatDate(selectedWeek.endDate)}`;
  const weekRows = buildWeekRows(selectedWeek.dateKeys, employees, displayedSchedules);
  const pendingChangeCount = Object.keys(pendingScheduleChanges).length;
  const hasPendingScheduleChanges = pendingChangeCount > 0;

  function showPendingDraftWarning(actionLabel) {
    showToast({
      type: 'error',
      title: 'Masih ada perubahan draft',
      message: `Simpan atau batalkan perubahan dulu sebelum ${actionLabel}.`,
    });
  }

  function handleFilterChange(event) {
    if (isReadonly) {
      return;
    }

    if (hasPendingScheduleChanges) {
      showPendingDraftWarning('mengganti tanggal acuan');
      return;
    }

    const { value } = event.target;
    const normalizedDate = getWeekDateRange(value).startDate;
    setFilters((current) => ({
      ...current,
      date: normalizedDate,
    }));
  }

  function handleWeekNavigation(offset) {
    if (isReadonly) {
      return;
    }

    if (hasPendingScheduleChanges) {
      showPendingDraftWarning('berpindah minggu');
      return;
    }

    setFilters((current) => ({
      ...current,
      date: shiftDateByDays(current.date, offset * 7),
    }));
  }

  function openEditModal(item) {
    setEditingSchedule(item);
    setIsFormOpen(true);
  }

  function openGeneratorModal() {
    if (hasPendingScheduleChanges) {
      showPendingDraftWarning('generate jadwal');
      return;
    }

    setGeneratorDraft({
      date: filters.date,
      holidayDates: buildHolidayInputValue(selectedWeekHolidayEntries),
    });
    setIsGeneratorOpen(true);
  }

  function openResetWeekDialog() {
    if (hasPendingScheduleChanges) {
      showPendingDraftWarning('reset jadwal minggu ini');
      return;
    }

    setIsResetWeekOpen(true);
  }

  async function handleSubmit(form) {
    try {
      assertPermission(canManageSchedules, 'Role Anda hanya punya akses baca untuk jadwal shift.');

      if (!editingSchedule) {
        throw new Error('Jadwal yang ingin diubah tidak ditemukan.');
      }

      if (!isDateWithinWeek(form.date, selectedWeek)) {
        throw new Error(
          `Perubahan tanggal hanya bisa dilakukan dalam minggu ${formatDate(selectedWeek.startDate)} - ${formatDate(selectedWeek.endDate)}.`,
        );
      }

      const selectedEmployee = employees.find((employee) => String(employee.id) === String(form.employee_id));

      if (!selectedEmployee) {
        throw new Error('Pegawai untuk jadwal ini tidak ditemukan.');
      }

      validateScheduleRuleForEntry({
        employee: selectedEmployee,
        date: form.date,
        shiftType: form.shift_type,
      });

      const originalSchedule = schedules.find((schedule) => String(schedule.id) === String(editingSchedule.id));

      if (!originalSchedule) {
        throw new Error('Jadwal asli tidak ditemukan. Refresh halaman lalu coba lagi.');
      }

      const nextDraftSchedule = {
        ...originalSchedule,
        date: form.date,
        employee_id: form.employee_id,
        shift_type: form.shift_type,
        start_time: form.start_time,
        end_time: form.end_time,
        notes: form.notes || null,
        employee: selectedEmployee,
      };

      setPendingScheduleChanges((current) => {
        const nextChanges = { ...current };

        if (areSchedulesEquivalent(originalSchedule, nextDraftSchedule)) {
          delete nextChanges[String(editingSchedule.id)];
        } else {
          nextChanges[String(editingSchedule.id)] = {
            type: 'update',
            schedule: nextDraftSchedule,
          };
        }

        return nextChanges;
      });

      setIsFormOpen(false);
      setEditingSchedule(null);

      showToast({
        type: 'success',
        title: 'Perubahan masuk draft',
        message: 'Anda bisa lanjut ubah jadwal lain dulu, lalu simpan semuanya sekaligus.',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Gagal menyimpan draft jadwal',
        message: error.message,
      });
    }
  }

  function handleRequestDeleteFromForm(schedule) {
    setIsFormOpen(false);
    setEditingSchedule(null);
    setDeleteTarget(schedule);
  }

  function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      assertPermission(canManageSchedules, 'Role Anda hanya punya akses baca untuk jadwal shift.');
      setPendingScheduleChanges((current) => ({
        ...current,
        [String(deleteTarget.id)]: {
          type: 'delete',
        },
      }));
      setDeleteTarget(null);
      showToast({
        type: 'success',
        title: 'Jadwal ditandai untuk dihapus',
        message: 'Perubahan ini akan diterapkan saat Anda menekan Simpan Perubahan.',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Gagal menandai hapus jadwal',
        message: error.message,
      });
    }
  }

  function handleDiscardPendingChanges() {
    setPendingScheduleChanges({});
    setDeleteTarget(null);
    setEditingSchedule(null);
    setIsFormOpen(false);
    showToast({
      type: 'success',
      title: 'Draft dibatalkan',
      message: 'Semua perubahan draft untuk minggu ini sudah dibatalkan.',
    });
  }

  async function handleCommitPendingChanges() {
    if (!hasPendingScheduleChanges) {
      return;
    }

    try {
      assertPermission(canManageSchedules, 'Role Anda hanya punya akses baca untuk jadwal shift.');
      setSaving(true);

      const latestWeekSchedules = await listSchedules({
        dateFrom: selectedWeek.startDate,
        dateTo: selectedWeek.endDate,
      });
      const finalSchedules = applyPendingScheduleChanges(latestWeekSchedules, pendingScheduleChanges, employeesById).map(
        ({ isPending, ...schedule }) => schedule,
      );
      const holidayDates = selectedWeekHolidayEntries.map((entry) => entry.date);

      validateScheduleWeekRules({
        employees,
        schedules: finalSchedules,
        weekDateKeys: selectedWeek.dateKeys,
        holidayDates,
      });

      if (finalSchedules.length > 0) {
        await upsertSchedules(finalSchedules.map((schedule) => normalizeScheduleForPersistence(schedule, user.id)));
      }

      const finalScheduleKeys = new Set(finalSchedules.map((schedule) => buildScheduleUniqueKey(schedule)));
      const obsoleteScheduleIds = latestWeekSchedules
        .filter((schedule) => !finalScheduleKeys.has(buildScheduleUniqueKey(schedule)))
        .map((schedule) => schedule.id);

      if (obsoleteScheduleIds.length > 0) {
        await deleteSchedulesByIds(obsoleteScheduleIds);
      }

      setPendingScheduleChanges({});
      await loadSchedulePage(filters);

      showToast({
        type: 'success',
        title: 'Perubahan jadwal tersimpan',
        message: `${pendingChangeCount} perubahan berhasil disimpan dan dicek sesuai rules minggu ini.`,
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Gagal menyimpan perubahan jadwal',
        message: error.message,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleResetWeekSchedules() {
    try {
      assertPermission(canManageSchedules, 'Role Anda hanya punya akses baca untuk jadwal shift.');
      setResetting(true);
      const weekRange = getWeekDateRange(filters.date);
      await deleteSchedules({
        dateFrom: weekRange.startDate,
        dateTo: weekRange.endDate,
      });
      setPendingScheduleChanges({});
      await loadSchedulePage(filters);
      setIsResetWeekOpen(false);
      showToast({
        type: 'success',
        title: 'Jadwal minggu berhasil direset',
        message: `Jadwal untuk minggu ${formatDate(weekRange.startDate)} - ${formatDate(weekRange.endDate)} berhasil dihapus.`,
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Reset jadwal gagal',
        message: error.message,
      });
    } finally {
      setResetting(false);
    }
  }

  async function handleGenerateWeeklySchedule(form) {
    try {
      assertPermission(canManageSchedules, 'Role Anda hanya punya akses baca untuk jadwal shift.');

      if (hasPendingScheduleChanges) {
        showPendingDraftWarning('generate jadwal');
        return;
      }

      setGenerating(true);

      const weekRange = getWeekDateRange(form.date);
      const holidayEntries = parseHolidayEntryInput(form.holidayDates, weekRange);
      const holidayDates = holidayEntries.map((entry) => entry.date);
      const existingWeekSchedules = await listSchedules({
        dateFrom: weekRange.startDate,
        dateTo: weekRange.endDate,
      });
      const generatedSchedules = generateWeeklySchedules({
        date: form.date,
        employees,
        existingSchedules: existingWeekSchedules,
        createdBy: user.id,
        holidayDates,
      });

      await bulkCreateSchedules(generatedSchedules);

      const nextFilters = isSameWeek(filters.date, form.date)
        ? filters
        : {
            ...filters,
            date: form.date,
          };

      setHolidayEntriesByDate((current) => mergeHolidayEntriesForWeek(current, weekRange.dateKeys, holidayEntries));
      setGeneratorDraft({
        date: form.date,
        holidayDates: buildHolidayInputValue(holidayEntries),
      });
      setIsGeneratorOpen(false);

      if (nextFilters.date !== filters.date) {
        setFilters(nextFilters);
      } else {
        await loadSchedulePage(nextFilters);
      }

      showToast({
        type: 'success',
        title: 'Generate jadwal berhasil',
        message:
          existingWeekSchedules.length > 0
            ? `${generatedSchedules.length} jadwal baru untuk minggu ${formatDate(weekRange.startDate)} - ${formatDate(weekRange.endDate)} berhasil dibuat. Jadwal yang sudah ada tetap dipertahankan.`
            : `${generatedSchedules.length} jadwal untuk minggu ${formatDate(weekRange.startDate)} - ${formatDate(weekRange.endDate)} berhasil dibuat.`,
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Generate jadwal gagal',
        message: error.message,
      });
    } finally {
      setGenerating(false);
    }
  }

  function renderWeekNavigationButtons() {
    const isNavigationDisabled = hasPendingScheduleChanges || saving;

    return (
      <div className="flex flex-wrap gap-2">
        <Button className="h-[46px]" disabled={isNavigationDisabled} onClick={() => handleWeekNavigation(-1)} variant="secondary">
          <ChevronLeft className="h-4 w-4" />
          Minggu Sebelumnya
        </Button>
        <Button className="h-[46px]" disabled={isNavigationDisabled} onClick={() => handleWeekNavigation(1)} variant="secondary">
          Minggu Berikutnya
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  function renderManagementButtons() {
    if (!canManageSchedules) {
      return null;
    }

    const isActionDisabled = hasPendingScheduleChanges || saving;

    return (
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <Button className="h-[46px] w-full sm:w-auto" disabled={resetting || isActionDisabled} onClick={openResetWeekDialog} variant="danger">
          <Trash2 className="h-4 w-4" />
          {resetting ? 'Mereset...' : 'Reset'}
        </Button>
        <Button className="h-[46px] w-full sm:w-auto" disabled={generating || isActionDisabled} onClick={openGeneratorModal} variant="secondary">
          <Sparkles className="h-4 w-4" />
          {generating ? 'Generating...' : 'Generate'}
        </Button>
      </div>
    );
  }

  function renderPendingDraftBanner() {
    if (!hasPendingScheduleChanges || !canManageSchedules) {
      return null;
    }

    return (
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm font-medium text-amber-900">
          {pendingChangeCount} perubahan belum disimpan. Lanjutkan edit beberapa jadwal dulu, lalu simpan sekaligus agar rules dicek di akhir.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button className="h-[46px]" disabled={saving} onClick={handleDiscardPendingChanges} variant="secondary">
            Batalkan
          </Button>
          <Button className="h-[46px]" disabled={saving} onClick={handleCommitPendingChanges} variant="brand">
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Jadwal Shift" />

      {!isReadonly ? (
      <div className="surface relative z-30 mb-6 p-4">
        <div className="flex flex-col gap-4 lg:hidden">
          <DatePickerInput disabled={hasPendingScheduleChanges || saving} label="Tanggal Acuan" name="date" onChange={handleFilterChange} value={filters.date} />
          <div>
            <p className="label">Navigasi Minggu</p>
            {renderWeekNavigationButtons()}
          </div>
          {renderManagementButtons()}
        </div>

        <div className={`hidden gap-3 lg:grid ${canManageSchedules ? 'lg:grid-cols-[220px,minmax(0,1fr),auto]' : 'lg:grid-cols-[220px,minmax(0,1fr)]'}`}>
          <p className="label mb-0">Tanggal Acuan</p>
          <p className="label mb-0">Navigasi Minggu</p>
          {canManageSchedules ? <span /> : null}

          <DatePickerInput className="lg:w-[220px]" disabled={hasPendingScheduleChanges || saving} name="date" onChange={handleFilterChange} value={filters.date} />
          {renderWeekNavigationButtons()}
          {renderManagementButtons()}
        </div>

        {renderPendingDraftBanner()}
      </div>
      ) : null}

      {loading ? (
        <div className="surface flex min-h-[260px] items-center justify-center">
          <Spinner label="Mengambil jadwal shift 1 minggu..." />
        </div>
      ) : (
        <ScheduleWeekView
          canManage={canManageSchedules}
          dateKeys={selectedWeek.dateKeys}
          holidayEntries={selectedWeekHolidayEntries}
          onEdit={openEditModal}
          rows={weekRows}
          weekLabel={weekLabel}
        />
      )}

      <ScheduleGeneratorModal
        initialDate={generatorDraft.date}
        initialHolidayDates={generatorDraft.holidayDates}
        isOpen={isGeneratorOpen}
        loading={generating}
        onClose={() => setIsGeneratorOpen(false)}
        onSubmit={handleGenerateWeeklySchedule}
      />

      <ScheduleFormModal
        employees={employees.filter((employee) => employee.status === 'aktif')}
        isOpen={isFormOpen}
        loading={false}
        onClose={() => {
          setIsFormOpen(false);
          setEditingSchedule(null);
        }}
        onRequestDelete={handleRequestDeleteFromForm}
        onSubmit={handleSubmit}
        schedule={editingSchedule}
        weekRange={selectedWeek}
      />

      <ConfirmDialog
        confirmLabel="Reset"
        description={`Semua jadwal untuk minggu ${formatDate(selectedWeek.startDate)} - ${formatDate(selectedWeek.endDate)} akan dihapus.`}
        isOpen={isResetWeekOpen}
        loading={resetting}
        onClose={() => setIsResetWeekOpen(false)}
        onConfirm={handleResetWeekSchedules}
        title="Reset jadwal minggu ini?"
      />

      <ConfirmDialog
        confirmLabel="Tandai Hapus"
        description={`Jadwal untuk ${deleteTarget?.employee?.name || 'pegawai'} pada ${deleteTarget ? formatDate(deleteTarget.date) : '-'} akan dihapus saat Anda menekan Simpan Perubahan.`}
        isOpen={Boolean(deleteTarget)}
        loading={false}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus jadwal shift ini dari draft?"
      />
    </div>
  );
}

export default SchedulesPage;



