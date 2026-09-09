import { useQuery } from '@tanstack/react-query';
import { get } from '../../lib/api';
import { Card, CardHeader, Badge } from '../../components/ui';

interface AuditEntry {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  target: string | null;
  createdAt: string;
}

const ACTOR_LABEL: Record<string, { label: string; class: string }> = {
  USER: { label: 'User', class: 'bg-slate-100 text-slate-600' },
  AI_AGENT: { label: 'AI Agent', class: 'bg-violet-100 text-violet-700' },
  SYSTEM: { label: 'System', class: 'bg-amber-100 text-amber-700' },
};

export function AdminAudit() {
  const { data: entries } = useQuery({
    queryKey: ['audit'],
    queryFn: () => get<AuditEntry[]>('/audit?limit=100'),
    refetchInterval: 30_000,
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Audit log</h1>
      <Card>
        <CardHeader
          title="Who / what / when"
          subtitle="Append-only. AI Agent actions are always attributed distinctly."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-4">Actor</th>
                <th className="pb-2 pr-4">Action</th>
                <th className="pb-2 pr-4">Target</th>
                <th className="pb-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {entries?.map((e) => {
                const actor = ACTOR_LABEL[e.actorType] ?? ACTOR_LABEL.SYSTEM;
                return (
                  <tr key={e.id} className="border-b border-slate-50">
                    <td className="py-2 pr-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${actor.class}`}>
                        {actor.label}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-slate-700">{e.action}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-slate-500">{e.target ?? '—'}</td>
                    <td className="py-2 text-xs text-slate-400">{new Date(e.createdAt).toLocaleString()}</td>
                  </tr>
                );
              })}
              {entries?.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-500">
                    No audit entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
