import { useEffect, useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import Select from '../ui/Select';
import { ROLE_OPTIONS } from '../../utils/constants';

const defaultValues = {
  full_name: '',
  email: '',
  password: '',
  role: 'viewer',
  is_active: true,
};

function UserFormModal({ currentUserId, isOpen, loading, onClose, onSubmit, user }) {
  const [form, setForm] = useState(defaultValues);
  const isEditing = Boolean(user?.id);
  const isSelf = Boolean(user?.id && user.id === currentUserId);
  const title = isEditing ? 'Edit User' : 'Tambah User';
  const description = isEditing
    ? isSelf
      ? 'Anda bisa memperbarui nama, email, dan password akun sendiri di sini. Role dan status akun sendiri tetap dikunci demi keamanan.'
      : 'Perbarui detail akun user, termasuk email login, password baru, role, dan status aktif.'
    : 'Buat user baru yang langsung bisa login ke aplikasi menggunakan email dan password yang Anda tentukan.';

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm({
      full_name: user?.full_name || '',
      email: user?.email || '',
      password: '',
      role: user?.role || 'viewer',
      is_active: user?.is_active == null ? true : Boolean(user.is_active),
    });
  }, [isOpen, user]);

  function handleChange(event) {
    const { checked, name, type, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const payload = {
      full_name: form.full_name,
      email: form.email,
      role: form.role,
      is_active: form.is_active,
    };

    if (form.password.trim()) {
      payload.password = form.password;
    }

    if (isSelf) {
      delete payload.role;
      delete payload.is_active;
    }

    await onSubmit(payload);
  }

  return (
    <Modal description={description} isOpen={isOpen} onClose={onClose} title={title}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input label="Nama Lengkap" name="full_name" onChange={handleChange} required value={form.full_name} />
        <Input label="Email" name="email" onChange={handleChange} required type="email" value={form.email} />
        <Input
          label={isEditing ? 'Password Baru' : 'Password'}
          name="password"
          onChange={handleChange}
          placeholder={isEditing ? 'Kosongkan jika tidak ingin mengganti password' : 'Minimal 6 karakter'}
          required={!isEditing}
          type="password"
          value={form.password}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Select disabled={isSelf} label="Role" name="role" onChange={handleChange} options={ROLE_OPTIONS} value={form.role} />
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 md:mt-[30px]">
            <input
              checked={form.is_active}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              disabled={isSelf}
              name="is_active"
              onChange={handleChange}
              type="checkbox"
            />
            User aktif
          </label>
        </div>

        {isSelf ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Role dan status akun sendiri tidak bisa diubah dari modal ini, tetapi nama, email, dan password tetap bisa diperbarui.
          </p>
        ) : null}

        <div className="flex justify-end gap-3 pt-2">
          <Button onClick={onClose} type="button" variant="secondary">
            Batal
          </Button>
          <Button disabled={loading} type="submit" variant="brand">
            {loading ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Tambah User'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default UserFormModal;
