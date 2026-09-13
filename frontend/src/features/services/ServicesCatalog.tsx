import { ServiceBox } from '../../components/ui/ServiceBox';
import { useServiceCatalog } from './useServiceCatalog';

/**
 * Client-dashboard view of the Service Box catalog (spec Section 4.1).
 * Same boxes as the marketing site — same data source, same component —
 * but the CTA links straight into the logged-in product request form.
 */
export function ServicesCatalog() {
  const { data: services, isLoading } = useServiceCatalog();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-slate-800">Services</h1>
      <p className="mb-6 text-sm text-slate-500">
        Everything Mugheer can build, run and automate for you. Click a box for details and to request it.
      </p>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(services ?? []).map((s) => (
            <ServiceBox key={s.slug} service={s} context="app" />
          ))}
        </div>
      )}
    </div>
  );
}
