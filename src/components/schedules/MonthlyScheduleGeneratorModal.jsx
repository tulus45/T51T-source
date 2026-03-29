import { useEffect, useState } from 'react';
import Button from '../ui/Button';
import DatePickerInput from '../ui/DatePickerInput';
import Modal from '../ui/Modal';
import Textarea from '../ui/Textarea';
import { getWeekDateRange } from '../../utils/schedule';

const defaultValues = {
  date: new Date().toISOString().slice(0, 10),
  holidayDates: '',
};

const generatorRules = [
  'Periode generate selalu 1 minggu penuh dari Senin sampai Minggu.',
  'Rule pegawai dibaca dari data pegawai aktif: shift yang diizinkan, hari libur, kasir, pimpinan shift, pisah shift, dan Tgl Merah Wajib Libur.',
  'Setiap hari hanya memakai shift pagi dan siang.',
  'Jumlah pegawai shift pagi dan siang harus seimbang, dengan selisih maksimal 1 orang per hari.',
  'Hari biasa maksimal 2 pegawai libur. Pada Sabtu, Minggu, dan tanggal merah jumlah pegawai libur bisa lebih dari 2 selama kebutuhan shift tetap terpenuhi.',
  'Setiap shift harus memiliki pegawai laki-laki dan perempuan, minimal 1 kasir, dan minimal 1 pimpinan shift.',
  'Pegawai yang masuk daftar pisah shift tidak boleh berada pada shift yang sama.',
  'Pada setiap tanggal merah, generator akan meliburkan minimal 1 pegawai dari daftar Tgl Merah Wajib Libur, bukan semuanya sekaligus.',
  'Jika libur utama jatuh di tanggal merah, generator akan menambahkan libur tambahan pada minggu yang sama. Pegawai yang wajib libur di tanggal merah boleh mendapat libur lebih dari 1 hari bila diperlukan agar jadwal tetap valid.',
  'Sehari sebelum libur pegawai diprioritaskan shift pagi, dan sehari sesudah libur diprioritaskan shift siang selama tidak bertabrakan dengan rule pegawai.',
];

function ScheduleGeneratorModal({ initialDate, initialHolidayDates = '', isOpen, loading, onClose, onSubmit }) {
  const [form, setForm] = useState(defaultValues);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const normalizedDate = getWeekDateRange(initialDate || new Date().toISOString().slice(0, 10)).startDate;

    setForm({
      date: normalizedDate,
      holidayDates: initialHolidayDates || '',
    });
  }, [initialDate, initialHolidayDates, isOpen]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: name === 'date' ? getWeekDateRange(value).startDate : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onSubmit(form);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title="Generate Jadwal 1 Minggu">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <DatePickerInput label="Tanggal Acuan" name="date" onChange={handleChange} value={form.date} />

        <Textarea
          className="min-h-[120px]"
          label="Tanggal Merah"
          name="holidayDates"
          onChange={handleChange}
          placeholder={'2026-03-31 | Nyepi\n2026-04-03 | Wafat Isa Almasih'}
          value={form.holidayDates}
        />

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          <p className="font-semibold text-slate-900">Rules Generate Jadwal</p>
          <ul className="mt-3 space-y-2">
            {generatorRules.map((rule) => (
              <li className="flex items-start gap-3" key={rule}>
                <span aria-hidden="true" className="mt-2 inline-block h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button onClick={onClose} type="button" variant="secondary">
            Batal
          </Button>
          <Button disabled={loading} type="submit" variant="brand">
            {loading ? 'Generating...' : 'Generate'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default ScheduleGeneratorModal;


