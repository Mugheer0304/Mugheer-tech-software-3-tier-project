import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { get, patch, post } from '../../lib/api';
import { Card, CardHeader, Badge, Button, Select } from '../../components/ui';

interface Product {
  id: string;
  name: string;
  status: string;
  serviceLine: string;
  organization: { id: string; name: string };
}

const STATUSES = ['REQUESTED', 'SCOPED', 'IN_DESIGN', 'IN_DEVELOPMENT', 'IN_QA', 'STAGED', 'LAUNCHED', 'MONITORED', 'ARCHIVED'];

export function AdminProducts() {
  const queryClient = useQueryClient();
  const { data: products, isLoading } = useQuery({ queryKey: ['admin-products'], queryFn: () => get<Product[]>('/projects') });
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => patch(`/projects/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
  });

  const createTask = useMutation({
    mutationFn: ({ productId, title }: { productId: string; title: string }) =>
      post('/tasks', { productId, title }),
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const [taskTitle, setTaskTitle] = useState('');
  const [taskProduct, setTaskProduct] = useState('');

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">All products</h1>

      <Card className="mb-6">
        <CardHeader title="Quick assign task" subtitle="Create a task against any client product." />
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label htmlFor="tp" className="mb-1 block text-xs font-medium text-slate-500">Product</label>
            <Select id="tp" value={taskProduct} onChange={(e) => setTaskProduct(e.target.value)}>
              <option value="">Select…</option>
              {products?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.organization.name})
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-64 flex-1">
            <label htmlFor="tt" className="mb-1 block text-xs font-medium text-slate-500">Task title</label>
            <input
              id="tt"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. Fix checkout edge case"
            />
          </div>
          <Button
            disabled={!taskProduct || !taskTitle.trim() || createTask.isPending}
            onClick={() => {
              createTask.mutate({ productId: taskProduct, title: taskTitle.trim() });
              setTaskTitle('');
            }}
          >
            Assign
          </Button>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-4">Product</th>
                  <th className="pb-2 pr-4">Client</th>
                  <th className="pb-2 pr-4">Service</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Move to</th>
                </tr>
              </thead>
              <tbody>
                {products?.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50">
                    <td className="py-2 pr-4">
                      <Link to={`/projects/${p.id}`} className="font-medium text-brand-600 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{p.organization.name}</td>
                    <td className="py-2 pr-4 text-slate-500">{p.serviceLine.replace(/_/g, ' ').toLowerCase()}</td>
                    <td className="py-2 pr-4">
                      <Badge value={p.status} />
                    </td>
                    <td className="py-2">
                      <Select
                        aria-label={`Change status for ${p.name}`}
                        value={statusDrafts[p.id] ?? p.status}
                        onChange={(e) => {
                          setStatusDrafts((prev) => ({ ...prev, [p.id]: e.target.value }));
                          updateStatus.mutate({ id: p.id, status: e.target.value });
                        }}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, ' ').toLowerCase()}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
