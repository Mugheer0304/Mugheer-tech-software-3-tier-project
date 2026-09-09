import { Link } from 'react-router-dom';

const SERVICES = [
  { name: 'Website / Web App Development', desc: 'Custom sites, portals, and web applications built end-to-end.' },
  { name: 'Product Design (UI/UX)', desc: 'Wireframes, prototypes, and design systems your users will love.' },
  { name: 'Backend / API Development', desc: 'Robust APIs, integrations, and data pipelines.' },
  { name: 'Mobile App Development', desc: 'iOS, Android, and cross-platform apps shipped to the stores.' },
  { name: 'Managed Monitoring', desc: '24/7 uptime, performance, and security monitoring with AI anomaly detection.' },
  { name: 'Automation Engineering', desc: 'CI/CD, workflow automation, and runbooks that remove toil.' },
  { name: 'AI Integration', desc: 'Chatbots, recommendations, and intelligent automation embedded in your product.' },
  { name: 'Maintenance Retainer', desc: 'Ongoing care: bug fixes, upgrades, and improvements on subscription.' },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-2xl font-bold text-brand-700">Mugheer</span>
        <nav className="flex items-center gap-3">
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
          Build. Monitor. Automate. <span className="text-brand-600">Everything, in one place.</span>
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

      <section className="border-t border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold text-slate-900">What we do</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s) => (
              <div key={s.name} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-800">{s.name}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.desc}</p>
              </div>
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

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Mugheer. All rights reserved.
      </footer>
    </div>
  );
}
