interface StatProps {
  label: string;
  value: string | number;
  delta?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}

export function Stat({ label, value, delta, tone = 'default' }: StatProps) {
  const toneClass = {
    default: 'text-slate-800',
    good: 'text-emerald-600',
    warn: 'text-amber-600',
    bad: 'text-red-600',
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {delta && <p className="mt-0.5 text-xs text-slate-500">{delta}</p>}
    </div>
  );
}
