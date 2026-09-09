import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get } from '../../lib/api';
import { Card, CardHeader, Badge, Stat, Button } from '../../components/ui';

export interface Product {
  id: string;
  name: string;
  status: string;
  serviceLine: string;
  productionUrl: string | null;
  organization: { id: string; name: string };
}

export function ClientDashboard() {
  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => get<Product[]>('/projects'),
  });

  const active = products?.filter((p) => !['ARCHIVED'].includes(p.status)) ?? [];
  const launched = products?.filter((p) => ['LAUNCHED', 'MONITORED'].includes(p.status)) ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Your products</h1>
        <Link to="/projects/new">
          <Button>Request a new product</Button>
        </Link>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Active products" value={active.length} />
        <Stat label="Launched & monitored" value={launched.length} tone="good" />
        <Stat label="Open support tickets" value="—" />
      </div>

      {isLoading ? (
        <Card>
          <p className="text-sm text-slate-500">Loading products…</p>
        </Card>
      ) : !products || products.length === 0 ? (
        <Card>
          <p className="text-slate-600">
            No products yet. <Link to="/projects/new" className="text-brand-600 hover:underline">Request your first product</Link> and we'll get started.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {products.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="block">
              <Card className="transition hover:border-brand-300 hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">{p.name}</h3>
                    <p className="mt-0.5 text-sm text-slate-500">{p.serviceLine.replace(/_/g, ' ').toLowerCase()}</p>
                  </div>
                  <Badge value={p.status} />
                </div>
                {p.productionUrl && (
                  <p className="mt-3 truncate text-sm text-brand-600">{p.productionUrl}</p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
