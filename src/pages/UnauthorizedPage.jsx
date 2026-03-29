import { Link } from 'react-router-dom';

function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="surface max-w-lg p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-500">401 Unauthorized</p>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">Akses ditolak</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Role akun Anda tidak memiliki izin untuk membuka halaman ini. Silakan kembali ke dashboard atau hubungi super admin.
        </p>
        <Link className="mt-8 inline-flex rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700" to="/dashboard">
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}

export default UnauthorizedPage;
