import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface ServiceLine {
  id: string;
  slug: string;
  serviceLine: string;
  name: string;
  summary: string;
  description?: string;
  icon: string;
  startingPrice: number;
  currency: string;
  includes?: string[] | null;
  timelineWeeks?: number | null;
  statusPipeline?: string[] | null;
  isMostRequested?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

interface ServiceBoxProps {
  service: ServiceLine;
  /** "public" on the marketing site (expands in place), "app" in the dashboard (opens detail panel). */
  context?: 'public' | 'app';
  /** Extra CTA override, e.g. admin console manage action. */
  renderActions?: (s: ServiceLine) => ReactNode;
}

/**
 * The Service Box (spec Section 4.1) — a self-contained card rendered from
 * service_lines data, never a plain link list. Clicking opens a next-step
 * detail view (expanding panel) with the full description, inclusions,
 * timeline and a "Request This Service" CTA that pre-fills the product
 * request form with this service line selected.
 */
export function ServiceBox({ service, context = 'public', renderActions }: ServiceBoxProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`group relative flex flex-col rounded-xl border bg-white p-5 shadow-sm transition-all duration-200 ease-out ${
        open
          ? 'border-brand-300 shadow-lg ring-1 ring-brand-200'
          : 'border-slate-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md'
      }`}
    >
      {service.isMostRequested && (
        <span className="absolute -top-2 right-4 rounded-full bg-accent-500 px-2 py-0.5 text-[11px] font-semibold text-white">
          Most requested
        </span>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`service-box-detail-${service.slug}`}
        className="flex flex-1 flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-lg"
      >
        <span className="text-2xl" aria-hidden>
          {service.icon}
        </span>
        <span className="mt-3 font-semibold text-slate-800">{service.name}</span>
        <span className="mt-1 flex-1 text-sm text-slate-600">{service.summary}</span>
        <span className="mt-4 text-sm text-slate-500">
          Starting from{' '}
          <span className="font-semibold text-brand-700">
            ${service.startingPrice.toLocaleString()}
          </span>
        </span>
        <span className="mt-3 text-xs font-medium text-brand-600 group-hover:underline">
          {open ? 'Close details ▲' : 'View details ▼'}
        </span>
      </button>

      {open && (
        <div
          id={`service-box-detail-${service.slug}`}
          className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm transition-all duration-200 ease-out"
        >
          <p className="text-slate-700">{service.description}</p>

          {service.includes && service.includes.length > 0 && (
            <>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">What's included</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-700">
                {service.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}

          {service.timelineWeeks != null && (
            <p className="mt-3 text-slate-600">
              <span className="font-medium text-slate-700">Typical timeline:</span> ~{service.timelineWeeks} week{service.timelineWeeks === 1 ? '' : 's'}
            </p>
          )}

          {renderActions ? (
            <div className="mt-4 flex flex-wrap gap-2">{renderActions(service)}</div>
          ) : context === 'app' ? (
            <div className="mt-4">
              <Link
                to={`/projects/new?service=${service.serviceLine}`}
                className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                Request This Service
              </Link>
            </div>
          ) : (
            <div className="mt-4">
              <Link
                to={`/signup?service=${service.serviceLine}`}
                className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                Request This Service
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
