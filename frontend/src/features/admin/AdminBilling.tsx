import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../../lib/api';
import { Card, CardHeader, Button, Badge, Input, Field, Select } from '../../components/ui';

interface Invoice {
  id: string;
  number: string;
  amount: number;
  taxAmount: number;
  currency: string;
  status: string;
  organization?: { name: string };
}

interface Org {
  id: string;
  name: string;
}

export function AdminBilling() {
  const queryClient = useQueryClient();
  const { data: invoices } = useQuery({ queryKey: ['admin-invoices'], queryFn: () => get<Invoice[]>('/billing/invoices') });
  const [orgId, setOrgId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const orgs = useQuery({ queryKey: ['orgs'], queryFn: () => get<Org[]>('/orgs'), retry: false });

  const createInvoice = useMutation({
    mutationFn: () =>
      post('/billing/invoices', {
        orgId,
        amount: parseFloat(amount),
        lineItems: [{ description, quantity: 1, unitPrice: parseFloat(amount) }],
      }),
    onSuccess: () => {
      setAmount('');
      setDescription('');
      void queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
    },
    onError: (err) => setError(err.message),
  });

  const refund = useMutation({
    mutationFn: ({ id, amt }: { id: string; amt: number }) => post(`/billing/invoices/${id}/refund`, { amount: amt }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-invoices'] }),
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Billing management</h1>

      <Card className="mb-6">
        <CardHeader title="Create invoice" subtitle="Tax is computed from the client's configured rate." />
        {error && <div role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="inv-org" className="mb-1 block text-xs font-medium text-slate-500">Client</label>
            <Select id="inv-org" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">Select client…</option>
              {orgs.data && Array.isArray(orgs.data)
                ? (orgs.data as Org[]).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))
                : null}
            </Select>
          </div>
          <Field label="Amount (USD)" htmlFor="inv-amount">
            <Input id="inv-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Description" htmlFor="inv-desc">
            <Input id="inv-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Sprint 12 delivery" />
          </Field>
        </div>
        <Button
          disabled={!orgId || !amount || createInvoice.isPending}
          onClick={() => createInvoice.mutate()}
        >
          {createInvoice.isPending ? 'Creating…' : 'Create & send invoice'}
        </Button>
      </Card>

      <Card>
        <CardHeader title="All invoices" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-4">Invoice</th>
                <th className="pb-2 pr-4">Total</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Refund</th>
              </tr>
            </thead>
            <tbody>
              {invoices?.filter((i) => i.status === 'PAID').map((inv) => (
                <tr key={inv.id} className="border-b border-slate-50">
                  <td className="py-2 pr-4 font-medium text-slate-700">{inv.number}</td>
                  <td className="py-2 pr-4">{inv.currency} {(inv.amount + inv.taxAmount).toFixed(2)}</td>
                  <td className="py-2 pr-4">
                    <Badge value={inv.status} />
                  </td>
                  <td className="py-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => refund.mutate({ id: inv.id, amt: inv.amount + inv.taxAmount })}
                    >
                      Full refund
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">Only paid invoices are refundable. All refunds are audit-logged.</p>
      </Card>
    </div>
  );
}
