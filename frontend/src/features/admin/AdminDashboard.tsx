import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { get } from '../../lib/api';
import { Card, CardHeader, Badge, Stat, AiTag } from '../../components/ui';

interface Stats {
  users: number;
  clientOrgs: number;
  products: number;
  openAlerts: number;
  openTickets: number;
  monthlyRecurringRevenue: number;
}

interface Alert {
  id: string;
  severity: string;
  message: string;
  status: string;
  aiConfidence: number | null;
  aiRootCause: string | null;
  createdAt: string;
  product: { id: string; name: string };
}

export function AdminDashboard() {
  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: () => get<Stats>('/admin/stats') });
  const { data: alerts } = useQuery({
    queryKey: ['alerts-open'],
    queryFn: () => get<Alert[]>('/monitoring/alerts?status=OPEN'),
    refetchInterval: 30_000,
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Operations console</h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Users" value={stats?.users ?? '—'} />
        <Stat label="Client orgs" value={stats?.clientOrgs ?? '—'} />
        <Stat label="Products" value={stats?.products ?? '—'} />
        <Stat label="Open alerts" value={stats?.openAlerts ?? '—'} tone={(stats?.openAlerts ?? 0) > 0 ? 'bad' : 'good'} />
        <Stat label="Open tickets" value={stats?.openTickets ?? '—'} />
        <Stat label="MRR" value={`$${(stats?.monthlyRecurringRevenue ?? 0).toLocaleString()}`} tone="good" />
      </div>

      <Card>
        <CardHeader
          title="Alert triage"
          subtitle="AI suggests root causes — humans confirm and act."
          action={
            <Link to="/tickets" className="text-sm font-medium text-brand-600 hover:underline">
              Tickets →
            </Link>
          }
        />
        <ul className="space-y-2">
          {alerts?.slice(0, 10).map((a) => (
            <li key={a.id} className="rounded-lg border border-slate-100 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-700">{a.message}</span>
                <span className="flex items-center gap-2">
                  {a.aiConfidence !== null && <AiTag label={`conf ${Math.round(a.aiConfidence * 100)}%`} />}
                  <Badge value={a.severity} />
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {a.product.name} · {new Date(a.createdAt).toLocaleString()}
              </p>
              {a.aiRootCause && <p className="mt-1 text-xs italic text-slate-500">AI root cause: {a.aiRootCause}</p>}
            </li>
          ))}
          {alerts?.length === 0 && <li className="text-sm text-slate-500">No open alerts. Systems healthy. 🎉</li>}
          {!alerts && <li className="text-sm text-slate-500">Loading…</li>}
        </ul>
      </Card>
    </div>
  );
}
