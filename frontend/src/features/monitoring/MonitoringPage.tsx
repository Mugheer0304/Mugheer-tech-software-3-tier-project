import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { get } from '../../lib/api';
import { useLiveProduct } from '../../lib/ws';
import { Card, CardHeader, Badge, Stat, AiTag } from '../../components/ui';

interface Panel {
  metricName: string;
  count: number;
  avg: number;
  max: number;
  min: number;
  last: number | null;
  points: { t: string; v: number }[];
}

interface DashboardData {
  product: { id: string; name: string; status: string; productionUrl: string | null };
  panels: Panel[];
  openAlerts: number;
  uptime30d: number | null;
  aiInsight: string | null;
}

const METRIC_LABELS: Record<string, string> = {
  response_time_ms: 'Response time (ms)',
  error_rate: 'Error rate',
  cpu_percent: 'CPU %',
  uptime: 'Uptime (1=up, 0=down)',
};

export function MonitoringPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['monitoring', id],
    queryFn: () => get<DashboardData>(`/monitoring/products/${id}/dashboard`),
    refetchInterval: 30_000,
    enabled: Boolean(id),
  });
  const live = useLiveProduct(id ?? null);

  if (isLoading) return <p className="text-slate-500">Loading monitoring…</p>;
  if (!data) return <p className="text-slate-500">No monitoring data.</p>;

  const livePoints = live.metrics.filter((m) => m.productId === id);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Monitoring — {data.product.name}</h1>
          {data.product.productionUrl && (
            <a href={data.product.productionUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-600 hover:underline">
              {data.product.productionUrl}
            </a>
          )}
        </div>
        <span className={`flex items-center gap-2 text-sm ${live.connected ? 'text-emerald-600' : 'text-slate-400'}`}>
          <span className={`h-2 w-2 rounded-full ${live.connected ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`} />
          {live.connected ? 'Live' : 'Polling'}
        </span>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Uptime (30d)" value={data.uptime30d !== null ? `${data.uptime30d.toFixed(2)}%` : '—'} tone={data.uptime30d !== null && data.uptime30d >= 99.9 ? 'good' : 'warn'} />
        <Stat label="Open alerts" value={data.openAlerts} tone={data.openAlerts > 0 ? 'bad' : 'good'} />
        {data.panels.slice(0, 2).map((p) => (
          <Stat
            key={p.metricName}
            label={`Avg ${METRIC_LABELS[p.metricName] ?? p.metricName}`}
            value={p.avg ? p.avg.toFixed(p.avg < 10 ? 2 : 0) : '—'}
            delta={`max ${p.max.toFixed(0)}`}
          />
        ))}
      </div>

      {data.aiInsight && (
        <Card className="mb-6 border-violet-200 bg-gradient-to-r from-violet-50 to-teal-50">
          <CardHeader title={<span className="flex items-center gap-2">AI Insights <AiTag /></span>} />
          <p className="text-sm leading-relaxed text-slate-700">{data.aiInsight}</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {data.panels.map((panel) => {
          const chartData = panel.points.map((p) => ({
            time: new Date(p.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: panel.metricName === 'error_rate' ? p.v * 100 : p.v,
          }));
          return (
            <Card key={panel.metricName}>
              <CardHeader title={METRIC_LABELS[panel.metricName] ?? panel.metricName} subtitle={`${panel.count} samples (24h)`} />
              <div className="h-48" role="img" aria-label={`${panel.metricName} chart`}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={40} />
                    <YAxis tick={{ fontSize: 11 }} domain={panel.metricName === 'uptime' ? [-0.1, 1.1] : ['auto', 'auto']} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          );
        })}
      </div>

      {live.alerts.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Live alerts" subtitle="Streamed in real time." />
          <ul className="space-y-2">
            {live.alerts.map((a, i) => (
              <li key={`${a.id}-${i}`} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <span className="text-slate-700">{a.message}</span>
                <Badge value={a.severity} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
