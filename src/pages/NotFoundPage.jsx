import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="surface max-w-lg p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">404</p>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">Halaman tidak ditemukan</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          URL yang Anda buka tidak tersedia. Pastikan rute benar atau kembali ke halaman utama aplikasi.
        </p>
        <Link className="mt-8 inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" to="/dashboard">
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
