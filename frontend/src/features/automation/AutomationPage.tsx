import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch } from '../../lib/api';
import { Card, CardHeader, Button, Badge, Field, Input, Select } from '../../components/ui';

interface Runbook {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  metricName: string | null;
  threshold: number | null;
  action: string;
  enabled: boolean;
  runCount: number;
  maxRetries: number;
  lastRunAt: string | null;
  product: { id: string; name: string } | null;
}

const ACTIONS = [
  ['RESTART_SERVICE', 'Restart service'],
  ['SCALE_UP', 'Scale up'],
  ['OPEN_TICKET', 'Open a ticket'],
  ['SEND_EMAIL', 'Send email'],
  ['GENERATE_REPORT', 'Generate report'],
];

export function AutomationPage() {
  const queryClient = useQueryClient();
  const { data: runbooks, isLoading } = useQuery({
    queryKey: ['runbooks'],
    queryFn: () => get<Runbook[]>('/automation/runbooks'),
  });
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [metric, setMetric] = useState('cpu_percent');
  const [threshold, setThreshold] = useState('85');
  const [action, setAction] = useState('OPEN_TICKET');

  const toggle = useMutation({
    mutationFn: (rb: Runbook) => patch(`/automation/runbooks/${rb.id}`, { enabled: !rb.enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['runbooks'] }),
  });
  const execute = useMutation({
    mutationFn: (id: string) => post(`/automation/runbooks/${id}/execute`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['runbooks'] }),
  });
  const create = useMutation({
    mutationFn: () =>
      post('/automation/runbooks', {
        name,
        trigger: 'metric_threshold',
        metricName: metric,
        threshold: parseFloat(threshold),
        action,
        durationSec: 300,
      }),
    onSuccess: () => {
      setShowForm(false);
      setName('');
      void queryClient.invalidateQueries({ queryKey: ['runbooks'] });
    },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Automation</h1>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New runbook'}</Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="New runbook" subtitle="Trigger → condition → action. No YAML required." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="rb-name">
              <Input id="rb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Scale on high CPU" />
            </Field>
            <Field label="Watch metric" htmlFor="rb-metric">
              <Select id="rb-metric" value={metric} onChange={(e) => setMetric(e.target.value)}>
                <option value="cpu_percent">CPU %</option>
                <option value="response_time_ms">Response time (ms)</option>
                <option value="error_rate">Error rate</option>
              </Select>
            </Field>
            <Field label="Threshold" htmlFor="rb-threshold">
              <Input id="rb-threshold" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </Field>
            <Field label="Action" htmlFor="rb-action">
              <Select id="rb-action" value={action} onChange={(e) => setAction(e.target.value)}>
                {ACTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button
            onClick={() => create.mutate()}
            disabled={!name.trim() || create.isPending}
          >
            {create.isPending ? 'Creating…' : 'Create runbook'}
          </Button>
        </Card>
      )}

      {isLoading ? (
        <Card>Loading runbooks…</Card>
      ) : (
        <div className="space-y-3">
          {runbooks?.map((rb) => (
            <Card key={rb.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium text-slate-800">{rb.name}</h3>
                  <p className="mt-0.5 text-sm text-slate-500">
                    if <code className="rounded bg-slate-100 px-1">{rb.metricName}</code> &gt;{' '}
                    <code className="rounded bg-slate-100 px-1">{rb.threshold}</code> for 5m →{' '}
                    <span className="font-medium">{rb.action.replace(/_/g, ' ').toLowerCase()}</span>
                    {rb.product && <span className="ml-2 text-xs text-slate-400">on {rb.product.name}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge value={rb.enabled ? 'ACTIVE' : 'CANCELED'} />
                  <Button size="sm" variant="secondary" onClick={() => toggle.mutate(rb)}>
                    {rb.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button size="sm" onClick={() => execute.mutate(rb.id)} disabled={!rb.enabled}>
                    Run now
                  </Button>
                </div>
              </div>
              {rb.runCount > 0 && (
                <p className="mt-2 text-xs text-slate-400">
                  Run {rb.runCount}/{rb.maxRetries} times{rb.lastRunAt ? ` · last ${new Date(rb.lastRunAt).toLocaleString()}` : ''}
                </p>
              )}
            </Card>
          ))}
          {runbooks?.length === 0 && <Card>No runbooks yet — create your first automation.</Card>}
        </div>
      )}
    </div>
  );
}
