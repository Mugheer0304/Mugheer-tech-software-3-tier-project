import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../../lib/api';
import { Card, CardHeader, Button, Badge, Stat } from '../../components/ui';

interface Invoice {
  id: string;
  number: string;
  amount: number;
  taxAmount: number;
  currency: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  currency: string;
  pricingModel: string;
}

interface Subscription {
  id: string;
  status: string;
  plan: { name: string; basePrice: number };
  currentPeriodEnd: string | null;
}

export function BillingPage() {
  const queryClient = useQueryClient();
  const { data: invoices } = useQuery({ queryKey: ['invoices'], queryFn: () => get<Invoice[]>('/billing/invoices') });
  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: () => get<Plan[]>('/billing/plans') });
  const { data: subs } = useQuery({ queryKey: ['subs'], queryFn: () => get<Subscription[]>('/billing/subscriptions') });

  const pay = useMutation({
    mutationFn: (id: string) => post(`/billing/invoices/${id}/pay`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });
  const subscribe = useMutation({
    mutationFn: (planId: string) => post('/billing/subscriptions', { planId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subs'] }),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => post(`/billing/subscriptions/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subs'] }),
  });

  const totalOutstanding =
    invoices
      ?.filter((i) => i.status === 'SENT' || i.status === 'OVERDUE')
      .reduce((sum, i) => sum + i.amount + i.taxAmount, 0) ?? 0;
  const mrr = subs?.filter((s) => s.status === 'ACTIVE').reduce((sum, s) => sum + s.plan.basePrice, 0) ?? 0;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Billing</h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Outstanding balance" value={`$${totalOutstanding.toFixed(2)}`} tone={totalOutstanding > 0 ? 'warn' : 'good'} />
        <Stat label="Active subscriptions" value={subs?.filter((s) => s.status === 'ACTIVE').length ?? 0} />
        <Stat label="Monthly recurring" value={`$${mrr.toLocaleString()}`} />
      </div>

      <Card className="mb-6">
        <CardHeader title="Invoices" subtitle="Payment runs through Stripe — card data never touches our servers." />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-4">Invoice</th>
                <th className="pb-2 pr-4">Amount</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {invoices?.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-50">
                  <td className="py-2 pr-4 font-medium text-slate-700">{inv.number}</td>
                  <td className="py-2 pr-4">
                    {inv.currency} {(inv.amount + inv.taxAmount).toFixed(2)}
                  </td>
                  <td className="py-2 pr-4">
                    <Badge value={inv.status} />
                  </td>
                  <td className="py-2 pr-4 text-slate-500">{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 text-right">
                    {(inv.status === 'SENT' || inv.status === 'OVERDUE') && (
                      <Button size="sm" onClick={() => pay.mutate(inv.id)} disabled={pay.isPending}>
                        Pay now
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {invoices?.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500">
                    No invoices yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Plans" subtitle="Subscribe to managed services." />
          <ul className="space-y-3">
            {plans?.map((plan) => (
              <li key={plan.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                <div>
                  <p className="font-medium text-slate-700">{plan.name}</p>
                  <p className="text-xs text-slate-500">{plan.description}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800">
                    ${plan.basePrice.toLocaleString()}
                    <span className="text-xs font-normal text-slate-400">
                      /{plan.pricingModel === 'SUBSCRIPTION' ? 'mo' : 'project'}
                    </span>
                  </p>
                  <Button size="sm" variant="secondary" className="mt-1" onClick={() => subscribe.mutate(plan.id)} disabled={subscribe.isPending}>
                    Subscribe
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Your subscriptions" />
          <ul className="space-y-3">
            {subs?.map((sub) => (
              <li key={sub.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                <div>
                  <p className="font-medium text-slate-700">{sub.plan.name}</p>
                  {sub.currentPeriodEnd && (
                    <p className="text-xs text-slate-500">Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge value={sub.status} />
                  {sub.status === 'ACTIVE' && (
                    <Button size="sm" variant="ghost" onClick={() => cancel.mutate(sub.id)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </li>
            ))}
            {subs?.length === 0 && <li className="text-sm text-slate-500">No active subscriptions.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
