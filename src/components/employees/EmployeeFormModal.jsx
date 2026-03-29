import { useEffect, useMemo, useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import Select from '../ui/Select';
import { EMPLOYEE_GENDER_OPTIONS, EMPLOYEE_STATUS_OPTIONS } from '../../utils/constants';
import { SCHEDULE_RULE_WEEKDAY_OPTIONS } from '../../utils/schedule';

const weekdayOrder = SCHEDULE_RULE_WEEKDAY_OPTIONS.map((option) => option.value);

const defaultValues = {
  name: '',
  position: '',
  phone: '',
  email: '',
  gender: '',
  kasir: false,
  pimpinan_shift: false,
  shift_pagi: true,
  shift_siang: true,
  off_day_mode: 'all',
  off_day_weekdays: [...weekdayOrder],
  holiday_mandatory_off: false,
  separated_employee_ids: [],
  status: 'aktif',
  hierarchy_order: 1,
};

function sortValuesByOrder(values, orderedValues) {
  return [...values].sort((leftValue, rightValue) => orderedValues.indexOf(leftValue) - orderedValues.indexOf(rightValue));
}

function EmployeeFormModal({ employee, employees = [], isOpen, loading, onClose, onSubmit }) {
  const [form, setForm] = useState(defaultValues);
  const [photoFile, setPhotoFile] = useState(null);

  const availableSeparatedEmployees = useMemo(
    () =>
      [...employees]
        .filter((item) => String(item.id) !== String(employee?.id || ''))
        .sort((left, right) => {
          if (left.status !== right.status) {
            return left.status === 'aktif' ? -1 : 1;
          }

          const hierarchyDiff = (left.hierarchy_order || 999) - (right.hierarchy_order || 999);

          if (hierarchyDiff !== 0) {
            return hierarchyDiff;
          }

          return left.name.localeCompare(right.name);
        }),
    [employee?.id, employees],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const storedOffWeekdays = Array.isArray(employee?.off_day_weekdays)
      ? employee.off_day_weekdays.map((value) => Number(value)).filter((value) => weekdayOrder.includes(value))
      : [];
    const storedSeparatedEmployeeIds = Array.isArray(employee?.separated_employee_ids)
      ? Array.from(new Set(employee.separated_employee_ids.map((value) => String(value || '')).filter(Boolean)))
      : [];

    setForm({
      name: employee?.name || '',
      position: employee?.position || '',
      phone: employee?.phone || '',
      email: employee?.email || '',
      gender: employee?.gender || '',
      kasir: Boolean(employee?.kasir),
      pimpinan_shift: Boolean(employee?.pimpinan_shift),
      shift_pagi: employee?.shift_pagi == null ? true : Boolean(employee.shift_pagi),
      shift_siang: employee?.shift_siang == null ? true : Boolean(employee.shift_siang),
      off_day_mode: employee?.off_day_mode || 'all',
      off_day_weekdays: storedOffWeekdays.length ? sortValuesByOrder(storedOffWeekdays, weekdayOrder) : [...weekdayOrder],
      holiday_mandatory_off: Boolean(employee?.holiday_mandatory_off),
      separated_employee_ids: storedSeparatedEmployeeIds,
      status: employee?.status || 'aktif',
      hierarchy_order: employee?.hierarchy_order || 1,
    });
    setPhotoFile(null);
  }, [employee, isOpen]);

  function handleChange(event) {
    const { checked, name, type, value } = event.target;

    setForm((current) => {
      if (name === 'off_day_mode') {
        return {
          ...current,
          off_day_mode: value,
          off_day_weekdays: current.off_day_weekdays.length ? current.off_day_weekdays : [...weekdayOrder],
        };
      }

      return {
        ...current,
        [name]: name === 'hierarchy_order' ? Number(value) : type === 'checkbox' ? checked : value,
      };
    });
  }

  function toggleOffDay(weekday) {
    setForm((current) => {
      const isSelected = current.off_day_weekdays.includes(weekday);
      const nextOffDays = isSelected
        ? current.off_day_weekdays.filter((value) => value !== weekday)
        : [...current.off_day_weekdays, weekday];

      if (!nextOffDays.length) {
        return current;
      }

      return {
        ...current,
        off_day_weekdays: sortValuesByOrder(nextOffDays, weekdayOrder),
      };
    });
  }

  function toggleSeparatedEmployee(employeeId) {
    setForm((current) => {
      const normalizedEmployeeId = String(employeeId || '');
      const isSelected = current.separated_employee_ids.includes(normalizedEmployeeId);

      return {
        ...current,
        separated_employee_ids: isSelected
          ? current.separated_employee_ids.filter((value) => value !== normalizedEmployeeId)
          : [...current.separated_employee_ids, normalizedEmployeeId],
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onSubmit(form, photoFile);
  }

  return (
    <Modal
      description="Simpan data pegawai beserta foto profil dari Supabase Storage. Rule generator mingguan akan membaca setting shift, libur, dan pasangan pisah shift langsung dari data ini."
      isOpen={isOpen}
      onClose={onClose}
      title={employee ? 'Edit Pegawai' : 'Tambah Pegawai'}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input label="Nama Lengkap" name="name" onChange={handleChange} required value={form.name} />
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Jabatan" name="position" onChange={handleChange} required value={form.position} />
          <Input label="Urutan Struktur" min="1" name="hierarchy_order" onChange={handleChange} required type="number" value={form.hierarchy_order} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Nomor Telepon" name="phone" onChange={handleChange} value={form.phone} />
          <Input label="Email" name="email" onChange={handleChange} type="email" value={form.email} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Gender"
            name="gender"
            onChange={handleChange}
            options={EMPLOYEE_GENDER_OPTIONS}
            required
            value={form.gender}
          />
          <Select label="Status" name="status" onChange={handleChange} options={EMPLOYEE_STATUS_OPTIONS} value={form.status} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            <input
              checked={form.kasir}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              name="kasir"
              onChange={handleChange}
              type="checkbox"
            />
            Kasir
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            <input
              checked={form.pimpinan_shift}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              name="pimpinan_shift"
              onChange={handleChange}
              type="checkbox"
            />
            Pimpinan shift
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            <input
              checked={form.shift_pagi}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              name="shift_pagi"
              onChange={handleChange}
              type="checkbox"
            />
            Shift Pagi
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            <input
              checked={form.shift_siang}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              name="shift_siang"
              onChange={handleChange}
              type="checkbox"
            />
            Shift Siang
          </label>
        </div>

        <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-4 md:grid-cols-[220px,1fr]">
            <Select
              label="Libur"
              name="off_day_mode"
              onChange={handleChange}
              options={[
                { value: 'all', label: 'Semua hari' },
                { value: 'custom', label: 'Hari tertentu' },
              ]}
              value={form.off_day_mode}
            />
            <div>
              <p className="label">Hari Libur yang Diizinkan</p>
              {form.off_day_mode === 'all' ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                  Pegawai ini boleh mengambil libur di semua hari.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  {SCHEDULE_RULE_WEEKDAY_OPTIONS.map((option) => {
                    const isSelected = form.off_day_weekdays.includes(option.value);

                    return (
                      <button
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                          isSelected
                            ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                        key={option.value}
                        onClick={() => toggleOffDay(option.value)}
                        type="button"
                      >
                        {option.shortLabel}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
            <input
              checked={form.holiday_mandatory_off}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              name="holiday_mandatory_off"
              onChange={handleChange}
              type="checkbox"
            />
            Tanggal merah wajib libur
          </label>

          <div>
            <p className="label">Pisah Shift Dengan</p>
            <p className="mt-1 text-sm text-slate-500">Pilih satu atau lebih pegawai yang tidak boleh berada pada shift yang sama.</p>
            {availableSeparatedEmployees.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                Belum ada pegawai lain yang bisa dipilih.
              </div>
            ) : (
              <div className="mt-3 flex max-h-[220px] flex-wrap gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white px-4 py-3">
                {availableSeparatedEmployees.map((item) => {
                  const isSelected = form.separated_employee_ids.includes(String(item.id));

                  return (
                    <button
                      className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                        isSelected
                          ? 'border-rose-300 bg-rose-100 text-rose-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                      key={item.id}
                      onClick={() => toggleSeparatedEmployee(item.id)}
                      type="button"
                    >
                      <span className="block">{item.name}</span>
                      <span className="block text-xs font-medium opacity-80">{item.position}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <label className="block">
          <span className="label">Foto Pegawai</span>
          <input
            accept="image/*"
            className="input cursor-pointer py-2.5"
            onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
            type="file"
          />
          {(photoFile || employee?.photo_url) && (
            <span className="mt-2 block text-sm text-slate-500">{photoFile ? photoFile.name : 'Foto tersimpan di Storage'}</span>
          )}
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <Button onClick={onClose} type="button" variant="secondary">
            Batal
          </Button>
          <Button disabled={loading} type="submit" variant="brand">
            {loading ? 'Menyimpan...' : employee ? 'Simpan Perubahan' : 'Tambah Pegawai'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default EmployeeFormModal;
