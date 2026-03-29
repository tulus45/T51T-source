function Spinner({ label = 'Memuat...' }) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
      <span>{label}</span>
    </div>
  );
}

export default Spinner;
