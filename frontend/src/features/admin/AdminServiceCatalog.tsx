import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, patch } from '../../lib/api';
import { Button, Card, CardHeader, Input, Textarea, Field, Badge } from '../../components/ui';
import type { ServiceLine } from '../../components/ui/ServiceBox';

/**
 * Admin management for the service catalog (spec Sections 4.1 and 9.2).
 * Edits here change the Service Boxes on the marketing site and client
 * dashboard instantly — one component, two contexts, one data source.
 */
export function AdminServiceCatalog() {
  const queryClient = useQueryClient();
  const { data: services } = useQuery({
    queryKey: ['service-catalog', 'admin'],
    queryFn: () => get<ServiceLine[]>('/service-catalog/admin/all'),
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [active, setActive] = useState(true);

  const save = useMutation({
    mutationFn: (slug: string) =>
      patch(`/service-catalog/admin/${slug}`, {
        summary,
        description,
        startingPrice: price,
        isActive: active,
      }),
    onSuccess: () => {
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['service-catalog'] });
    },
  });

  const startEdit = (s: ServiceLine) => {
    setEditing(s.slug);
    setSummary(s.summary);
    setDescription(s.description ?? '');
    setPrice(s.startingPrice);
    setActive(s.isActive ?? true);
  };

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-slate-800">Service catalog</h1>
      <p className="mb-6 text-sm text-slate-500">
        These entries drive the Service Boxes clients see on the marketing site and their dashboard.
        Changes go live immediately — no redeploy needed.
      </p>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {(services ?? []).map((s) =>
          editing === s.slug ? (
            <Card key={s.slug}>
              <CardHeader title={`Edit: ${s.name}`} subtitle="Saved changes appear on Service Boxes right away." />
              <Field label="Summary" htmlFor={`sum-${s.slug}`}>
                <Input id={`sum-${s.slug}`} value={summary} onChange={(e) => setSummary(e.target.value)} />
              </Field>
              <Field label="Full description" htmlFor={`desc-${s.slug}`}>
                <Textarea id={`desc-${s.slug}`} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
              <Field label="Starting price (USD)" htmlFor={`price-${s.slug}`}>
                <Input id={`price-${s.slug}`} type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
              </Field>
              <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Active (visible to clients)
              </label>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => save.mutate(s.slug)} disabled={save.isPending}>
                  {save.isPending ? 'Saving…' : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </Card>
          ) : (
            <Card key={s.slug}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-2xl" aria-hidden>
                    {s.icon}
                  </span>
                  <h3 className="mt-2 font-semibold text-slate-800">{s.name}</h3>
                </div>
                <Badge value={s.isActive ? 'ACTIVE' : 'HIDDEN'} />
              </div>
              <p className="mt-2 text-sm text-slate-600">{s.summary}</p>
              <p className="mt-3 text-sm text-slate-500">
                Starting from <span className="font-semibold text-brand-700">${s.startingPrice.toLocaleString()}</span>
              </p>
              <Button size="sm" variant="secondary" className="mt-4" onClick={() => startEdit(s)}>
                Manage
              </Button>
            </Card>
          ),
        )}
      </div>
    </div>
  );
}
