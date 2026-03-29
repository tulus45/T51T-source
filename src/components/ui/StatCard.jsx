function StatCard({ label, value, hint, accent = 'brand' }) {
  const accentClass = {
    brand: 'from-brand-600/15 to-brand-100',
    green: 'from-emerald-600/15 to-emerald-100',
    red: 'from-rose-600/15 to-rose-100',
    slate: 'from-slate-800/15 to-slate-100',
  };

  return (
    <div className={`surface bg-gradient-to-br ${accentClass[accent] || accentClass.brand} p-4 sm:p-5`}>
      <p className="text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900 sm:mt-3 sm:text-3xl">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500 sm:text-sm">{hint}</p> : null}
    </div>
  );
}

export default StatCard;
