import Button from './Button';
import Modal from './Modal';

function ConfirmDialog({
  confirmLabel = 'Konfirmasi',
  description,
  isOpen,
  loading,
  onClose,
  onConfirm,
  title = 'Apakah Anda yakin?',
  tone = 'danger',
}) {
  return (
    <Modal description={description} isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex justify-end gap-3">
        <Button onClick={onClose} variant="secondary">
          Batal
        </Button>
        <Button disabled={loading} onClick={onConfirm} variant={tone}>
          {loading ? 'Memproses...' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
