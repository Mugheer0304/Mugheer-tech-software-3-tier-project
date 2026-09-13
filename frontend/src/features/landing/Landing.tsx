import { Link } from 'react-router-dom';
import { ServiceBox } from '../../components/ui/ServiceBox';
import { useServiceCatalog } from '../services/useServiceCatalog';
import { COMPANY } from '../../lib/company';

export function Landing() {
  const { data: services } = useServiceCatalog();

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-2xl font-bold text-brand-700">{COMPANY.name}</span>
        <nav className="flex items-center gap-3">
          <Link to="/contact" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Contact
          </Link>
          <Link to="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-14 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Build. Monitor. Automate. <span className="text-brand-600">Everything, connected.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Mugheer is the software house platform that lets you request products, watch them get built,
          monitor them live with AI, automate operations, and manage billing — from a single dashboard.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            to="/signup"
            className="rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow hover:bg-brand-700"
          >
            Start a project
          </Link>
          <Link
            to="/login"
            className="rounded-xl border border-slate-300 px-6 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50"
          >
            Client login
          </Link>
        </div>
      </section>

      {/* Service Boxes — rendered from the service_lines table, never hardcoded (spec 4.1) */}
      <section id="services" className="border-t border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold text-slate-900">What we do</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-600">
            Click any service to see what's included, typical timelines, and to request it — the form comes
            pre-filled with that service line.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(services ?? []).map((s) => (
              <ServiceBox key={s.slug} service={s} context="public" />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 sm:grid-cols-3">
          {[
            ['Request & scope', 'Describe what you need. Our AI drafts the brief; a human PM refines it into a quote.'],
            ['Watch it build', 'Sprint boards, design reviews, staging previews — full visibility while we build.'],
            ['Launch & relax', 'Live monitoring with AI anomaly detection, automated runbooks, and monthly reports.'],
          ].map(([title, desc]) => (
            <div key={title}>
              <h3 className="text-lg font-semibold text-brand-700">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Public marketing footer — company contact details per spec Section 27 */}
      <footer className="border-t border-slate-100 bg-slate-50 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 text-center text-sm text-slate-500">
          <span className="text-base font-bold text-brand-700">{COMPANY.name}</span>
          <span>{COMPANY.tagline}</span>
          <span>
            <a href={`mailto:${COMPANY.email}`} className="text-brand-600 hover:underline">
              {COMPANY.email}
            </a>
            {' · '}
            <a href={`tel:${COMPANY.phone.replace(/\s/g, '')}`} className="text-brand-600 hover:underline">
              {COMPANY.phone}
            </a>
          </span>
          <span>
            <Link to="/contact" className="text-brand-600 hover:underline">
              Contact us
            </Link>
          </span>
          <span>© {new Date().getFullYear()} {COMPANY.name}. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
