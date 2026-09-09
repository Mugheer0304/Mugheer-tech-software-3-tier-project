import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { post } from '../../lib/api';
import { Button, Card, CardHeader, Input, Textarea, Select, Field, AiTag } from '../../components/ui';

interface AiBrief {
  title: string;
  serviceLine: string;
  features: string[];
  complexity: string;
  roughEstimateUsd: number;
}

const SERVICE_LINES = [
  ['WEB_APP_DEVELOPMENT', 'Website / Web App'],
  ['PRODUCT_DESIGN', 'Product Design (UI/UX)'],
  ['BACKEND_API_DEVELOPMENT', 'Backend / API'],
  ['MOBILE_APP_DEVELOPMENT', 'Mobile App'],
  ['AI_INTEGRATION', 'AI Integration'],
];

export function NewProductRequest() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [serviceLine, setServiceLine] = useState('WEB_APP_DEVELOPMENT');
  const [brief, setBrief] = useState<AiBrief | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => post('/projects', { name, serviceLine, description }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/dashboard');
    },
    onError: (err) => setError(err.message),
  });

  const draftBrief = async () => {
    if (description.trim().length < 10) return;
    setBriefBusy(true);
    setError(null);
    try {
      const data = await post<AiBrief>('/ai/scope', { description });
      setBrief(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI brief unavailable');
    } finally {
      setBriefBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Request a product</h1>
      <form onSubmit={submit}>
        <Card className="mb-6">
          <CardHeader title="Tell us what you need" subtitle="The more detail, the sharper the quote." />
          {error && (
            <div role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <Field label="Product name" htmlFor="name">
            <Input id="name" required minLength={3} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Customer Portal" />
          </Field>
          <Field label="Service line" htmlFor="service">
            <Select id="service" value={serviceLine} onChange={(e) => setServiceLine(e.target.value)}>
              {SERVICE_LINES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" htmlFor="desc" hint="Goals, must-have features, links to anything useful.">
            <Textarea id="desc" required minLength={10} rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => void draftBrief()} disabled={briefBusy || description.trim().length < 10}>
              {briefBusy ? 'Drafting…' : '✨ Draft an AI brief'}
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Submitting…' : 'Submit request'}
            </Button>
          </div>
        </Card>

        {brief && (
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  AI-drafted brief <AiTag />
                </span>
              }
              subtitle="A human PM reviews every AI brief before quoting."
            />
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="font-medium text-slate-600">Suggested service line</dt>
                <dd className="text-slate-800">{brief.serviceLine.replace(/_/g, ' ').toLowerCase()}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-600">Complexity</dt>
                <dd className="text-slate-800">{brief.complexity}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-600">Rough estimate</dt>
                <dd className="text-slate-800">${brief.roughEstimateUsd.toLocaleString()}</dd>
              </div>
              {brief.features?.length > 0 && (
                <div>
                  <dt className="font-medium text-slate-600">Feature ideas</dt>
                  <dd>
                    <ul className="mt-1 list-disc pl-5 text-slate-700">
                      {brief.features.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        )}
      </form>
    </div>
  );
}
