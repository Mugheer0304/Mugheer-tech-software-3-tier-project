import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../../lib/api';
import { Card, CardHeader, Badge, Button, Textarea, AiTag } from '../../components/ui';

interface ProductDetailData {
  id: string;
  name: string;
  status: string;
  description: string | null;
  stagingUrl: string | null;
  productionUrl: string | null;
  organization: { id: string; name: string };
  stages: { id: string; stageName: string; enteredAt: string; exitedAt: string | null }[];
  tasks: { id: string; title: string; status: string; priority: string; assignee: { name: string } | null }[];
  designArtifacts: { id: string; name: string; fileUrl: string; version: number; approvedAt: string | null; rejected: boolean; feedback: string | null }[];
  deployments: { id: string; environment: string; commitSha: string; status: string; deployedAt: string }[];
  comments: { id: string; body: string; author: { name: string }; createdAt: string }[];
  quote: { id: string; amount: number; currency: string; status: string } | null;
}

const PIPELINE = ['REQUESTED', 'SCOPED', 'IN_DESIGN', 'IN_DEVELOPMENT', 'IN_QA', 'STAGED', 'LAUNCHED', 'MONITORED'];

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => get<ProductDetailData>(`/projects/${id}`),
    enabled: Boolean(id),
  });

  const addComment = useMutation({
    mutationFn: (body: string) => post(`/projects/${id}/comments`, { body }),
    onSuccess: () => {
      setComment('');
      void queryClient.invalidateQueries({ queryKey: ['product', id] });
    },
  });

  const reviewDesign = useMutation({
    mutationFn: ({ artifactId, approve }: { artifactId: string; approve: boolean }) =>
      post(`/projects/designs/${artifactId}/review`, { approve }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['product', id] }),
  });

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (!product) return <p className="text-slate-500">Product not found.</p>;

  const currentStage = PIPELINE.indexOf(product.status);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{product.name}</h1>
          <p className="text-sm text-slate-500">{product.organization.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge value={product.status} />
          <Link to={`/projects/${product.id}/monitoring`} className="text-sm font-medium text-brand-600 hover:underline">
            Live monitoring →
          </Link>
        </div>
      </div>

      {/* Stage pipeline */}
      <Card className="mb-6">
        <CardHeader title="Build pipeline" subtitle="Where your product is right now." />
        <ol className="flex flex-wrap items-center gap-y-3 text-xs" aria-label="Product stage pipeline">
          {PIPELINE.map((stage, i) => (
            <li key={stage} className="flex items-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 font-semibold ${
                  i < currentStage
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : i === currentStage
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 bg-white text-slate-400'
                }`}
                aria-current={i === currentStage ? 'step' : undefined}
              >
                {i < currentStage ? '✓' : i + 1}
              </span>
              <span className={`ml-1.5 mr-3 font-medium ${i <= currentStage ? 'text-slate-700' : 'text-slate-400'}`}>
                {stage.replace(/_/g, ' ').toLowerCase()}
              </span>
              {i < PIPELINE.length - 1 && <span className="mr-3 hidden h-px w-6 bg-slate-300 sm:block" aria-hidden />}
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tasks */}
        <Card>
          <CardHeader title="Sprint board" subtitle="What the team is working on." />
          <ul className="space-y-2">
            {product.tasks.slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <span className="text-slate-700">{t.title}</span>
                <span className="flex items-center gap-2">
                  {t.assignee && <span className="text-xs text-slate-400">{t.assignee.name}</span>}
                  <Badge value={t.status} />
                </span>
              </li>
            ))}
            {product.tasks.length === 0 && <li className="text-sm text-slate-500">No tasks visible yet.</li>}
          </ul>
        </Card>

        {/* Design review */}
        <Card>
          <CardHeader title="Design review" subtitle="Approve or send back mockups." />
          <ul className="space-y-3">
            {product.designArtifacts.slice(0, 5).map((d) => (
              <li key={d.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">
                    {d.name} <span className="text-xs text-slate-400">v{d.version}</span>
                  </span>
                  {d.approvedAt ? (
                    <Badge value="APPROVED" />
                  ) : d.rejected ? (
                    <Badge value="REJECTED" />
                  ) : (
                    <span className="flex gap-2">
                      <Button size="sm" onClick={() => reviewDesign.mutate({ artifactId: d.id, approve: true })}>
                        Approve
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => reviewDesign.mutate({ artifactId: d.id, approve: false })}>
                        Request changes
                      </Button>
                    </span>
                  )}
                </div>
                {d.feedback && <p className="mt-1 text-xs text-slate-500">{d.feedback}</p>}
              </li>
            ))}
            {product.designArtifacts.length === 0 && <li className="text-sm text-slate-500">No designs shared yet.</li>}
          </ul>
        </Card>

        {/* Deployments */}
        <Card>
          <CardHeader title="Recent deployments" />
          <ul className="space-y-2 text-sm">
            {product.deployments.slice(0, 6).map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span>
                  <Badge value={d.environment.toUpperCase()} className="mr-2" />
                  <code className="text-xs text-slate-500">{d.commitSha.slice(0, 7)}</code>
                </span>
                <span className="text-xs text-slate-400">{new Date(d.deployedAt).toLocaleString()}</span>
              </li>
            ))}
            {product.deployments.length === 0 && <li className="text-slate-500">No deployments yet.</li>}
          </ul>
        </Card>

        {/* Comments */}
        <Card>
          <CardHeader title="Discussion" />
          <ul className="mb-4 space-y-3">
            {product.comments.slice(0, 6).map((c) => (
              <li key={c.id} className="text-sm">
                <span className="font-medium text-slate-700">{c.author?.name ?? 'User'}</span>{' '}
                <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                <p className="text-slate-600">{c.body}</p>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (comment.trim()) addComment.mutate(comment.trim());
            }}
            className="flex gap-2"
          >
            <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment…" aria-label="New comment" />
            <Button type="submit" disabled={!comment.trim() || addComment.isPending}>
              Post
            </Button>
          </form>
        </Card>
      </div>

      {product.quote && (
        <Card className="mt-6">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                Quote <AiTag label={product.quote.status} />
              </span>
            }
          />
          <p className="text-lg font-semibold text-slate-800">
            {product.quote.currency} {product.quote.amount.toLocaleString()}
          </p>
        </Card>
      )}
    </div>
  );
}
