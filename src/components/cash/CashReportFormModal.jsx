import { useEffect, useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import { CASH_TYPE_OPTIONS } from '../../utils/constants';

const defaultValues = {
  date: new Date().toISOString().slice(0, 10),
  type: 'income',
  amount: '',
  category: '',
  description: '',
};

function CashReportFormModal({ cashReport, isOpen, loading, onClose, onSubmit }) {
  const [form, setForm] = useState(defaultValues);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm({
      date: cashReport?.date || new Date().toISOString().slice(0, 10),
      type: cashReport?.type || 'income',
      amount: cashReport?.amount || '',
      category: cashReport?.category || '',
      description: cashReport?.description || '',
    });
  }, [cashReport, isOpen]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === 'amount' ? value.replace(/[^0-9]/g, '') : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onSubmit({
      ...form,
      amount: Number(form.amount || 0),
    });
  }

  return (
    <Modal
      description="Catat pemasukan atau pengeluaran harian toko dengan rapi."
      isOpen={isOpen}
      onClose={onClose}
      title={cashReport ? 'Edit Laporan Kas' : 'Tambah Laporan Kas'}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Tanggal" name="date" onChange={handleChange} required type="date" value={form.date} />
          <Select label="Jenis Transaksi" name="type" onChange={handleChange} options={CASH_TYPE_OPTIONS} value={form.type} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Nominal" min="0" name="amount" onChange={handleChange} required type="number" value={form.amount} />
          <Input label="Kategori" name="category" onChange={handleChange} required value={form.category} />
        </div>
        <Textarea label="Deskripsi" name="description" onChange={handleChange} placeholder="Opsional" value={form.description} />
        <div className="flex justify-end gap-3 pt-2">
          <Button onClick={onClose} type="button" variant="secondary">
            Batal
          </Button>
          <Button disabled={loading} type="submit" variant="brand">
            {loading ? 'Menyimpan...' : cashReport ? 'Simpan Perubahan' : 'Tambah Laporan'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default CashReportFormModal;
