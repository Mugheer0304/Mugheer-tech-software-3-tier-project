const COLORS: Record<string, string> = {
  REQUESTED: 'bg-slate-100 text-slate-700',
  SCOPED: 'bg-violet-100 text-violet-700',
  IN_DESIGN: 'bg-pink-100 text-pink-700',
  IN_DEVELOPMENT: 'bg-brand-100 text-brand-700',
  IN_QA: 'bg-amber-100 text-amber-700',
  STAGED: 'bg-cyan-100 text-cyan-700',
  LAUNCHED: 'bg-emerald-100 text-emerald-700',
  MONITORED: 'bg-teal-100 text-teal-700',
  CRITICAL: 'bg-red-100 text-red-700',
  WARNING: 'bg-amber-100 text-amber-700',
  INFO: 'bg-slate-100 text-slate-600',
  OPEN: 'bg-red-100 text-red-700',
  ACKNOWLEDGED: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  SENT: 'bg-slate-100 text-slate-600',
  OVERDUE: 'bg-red-100 text-red-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  CANCELED: 'bg-slate-200 text-slate-600',
  PAST_DUE: 'bg-amber-100 text-amber-700',
};

export function Badge({ value, className = '' }: { value: string; className?: string }) {
  const color = COLORS[value] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color} ${className}`}>
      {value.replace(/_/g, ' ').toLowerCase()}
    </span>
  );
}
