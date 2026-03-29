import { cn } from '../../utils/helpers';

const tones = {
  brand: 'bg-brand-100 text-brand-700',
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-rose-100 text-rose-700',
  amber: 'bg-amber-100 text-amber-700',
  slate: 'bg-slate-100 text-slate-700',
};

function Badge({ children, tone = 'slate', className }) {
  return (
    <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-semibold', tones[tone], className)}>
      {children}
    </span>
  );
}

export default Badge;
