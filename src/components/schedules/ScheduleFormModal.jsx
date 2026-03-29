import { useEffect, useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import { SHIFT_HOURS, SHIFT_TYPE_OPTIONS } from '../../utils/constants';
import { getEmployeeScheduleRuleConfig } from '../../utils/schedule';

const defaultValues = {
  date: new Date().toISOString().slice(0, 10),
  employee_id: '',
  shift_type: 'pagi',
  start_time: SHIFT_HOURS.pagi.start,
  end_time: SHIFT_HOURS.pagi.end,
  notes: '',
};

function ScheduleFormModal({ employees, isOpen, loading, onClose, onRequestDelete, onSubmit, schedule }) {
  const [form, setForm] = useState(defaultValues);

  const selectedEmployee = employees.find((employee) => String(employee.id) === String(form.employee_id));
  const selectedEmployeeRules = getEmployeeScheduleRuleConfig(selectedEmployee);
  const singleWorkingShiftType = selectedEmployeeRules.singleWorkingShiftType;
  const shiftOptions = selectedEmployeeRules.manualAllowedShiftTypes.length
    ? SHIFT_TYPE_OPTIONS.filter(
        (option) => option.value === form.shift_type || selectedEmployeeRules.manualAllowedShiftTypes.includes(option.value),
      )
    : SHIFT_TYPE_OPTIONS;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const shiftType = schedule?.shift_type || 'pagi';
    const defaultHours = SHIFT_HOURS[shiftType];

    setForm({
      date: schedule?.date || new Date().toISOString().slice(0, 10),
      employee_id: schedule?.employee_id || '',
      shift_type: shiftType,
      start_time: schedule?.start_time || defaultHours.start,
      end_time: schedule?.end_time || defaultHours.end,
      notes: schedule?.notes || '',
    });
  }, [isOpen, schedule]);

  useEffect(() => {
    if (!isOpen || !singleWorkingShiftType) {
      return;
    }

    if (form.shift_type === singleWorkingShiftType || form.shift_type === 'libur') {
      return;
    }

    setForm((current) => ({
      ...current,
      shift_type: singleWorkingShiftType,
      start_time: SHIFT_HOURS[singleWorkingShiftType].start,
      end_time: SHIFT_HOURS[singleWorkingShiftType].end,
    }));
  }, [form.shift_type, isOpen, singleWorkingShiftType]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => {
      if (name === 'shift_type') {
        const hours = SHIFT_HOURS[value];
        return {
          ...current,
          shift_type: value,
          start_time: hours.start,
          end_time: hours.end,
        };
      }

      return {
        ...current,
        [name]: value,
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    await onSubmit({
      ...form,
      start_time: form.shift_type === 'libur' ? null : form.start_time,
      end_time: form.shift_type === 'libur' ? null : form.end_time,
    });
  }

  return (
    <Modal
      description="Perubahan disimpan sebagai draft minggu ini dulu. Rules mingguan baru dicek saat Anda menekan Simpan Perubahan."
      isOpen={isOpen}
      onClose={onClose}
      title={schedule ? 'Edit Jadwal Shift' : 'Tambah Jadwal Shift'}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Tanggal" readOnly value={form.date} />
          <Input
            label="Pegawai"
            readOnly
            value={selectedEmployee ? `${selectedEmployee.name}${selectedEmployee.position ? ` - ${selectedEmployee.position}` : ''}` : '-'}
          />
        </div>
        <Select label="Shift" name="shift_type" onChange={handleChange} options={shiftOptions} value={form.shift_type} />
        {singleWorkingShiftType ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {selectedEmployee?.name || 'Pegawai ini'} hanya bisa dijadwalkan pada shift {singleWorkingShiftType}.{' '}
            {selectedEmployeeRules.isWeekendOnlyOff
              ? 'Jika libur, hanya boleh pada Sabtu atau Minggu.'
              : 'Libur tetap mengikuti hari yang diizinkan pada profil pegawai.'}
          </p>
        ) : null}
        <Textarea label="Catatan" name="notes" onChange={handleChange} placeholder="Opsional" value={form.notes} />
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {schedule && onRequestDelete ? (
              <Button disabled={loading} onClick={() => onRequestDelete(schedule)} type="button" variant="danger">
                Tandai Hapus
              </Button>
            ) : null}
          </div>
          <div className="flex justify-end gap-3">
            <Button onClick={onClose} type="button" variant="secondary">
              Batal
            </Button>
            <Button disabled={loading} type="submit" variant="brand">
              {loading ? 'Menyimpan...' : schedule ? 'Simpan ke Draft' : 'Tambah ke Draft'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default ScheduleFormModal;
