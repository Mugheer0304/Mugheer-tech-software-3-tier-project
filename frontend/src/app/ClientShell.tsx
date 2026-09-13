import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get } from '../lib/api';
import { useAuth } from '../lib/auth.store';
import { COMPANY } from '../lib/company';

interface Notification {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

const NAV = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/services', label: 'Services' },
  { to: '/projects/new', label: 'Request a Product' },
  { to: '/tickets', label: 'Support' },
  { to: '/billing', label: 'Billing' },
  { to: '/automation', label: 'Automation' },
];

export function ClientShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => get<Notification[]>('/notifications'),
    refetchInterval: 60_000,
  });
  const unread = notifications?.filter((n) => !n.readAt).length ?? 0;

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center border-b border-slate-200 px-5">
          <span className="text-xl font-bold text-brand-700">Mugheer</span>
        </div>
        <nav className="flex flex-col gap-1 p-3" aria-label="Main navigation">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-end gap-4 border-b border-slate-200 bg-white px-6">
          <div className="relative" role="status" aria-label={`${unread} unread notifications`}>
            <span aria-hidden>🔔</span>
            {unread > 0 && (
              <span className="absolute -right-2 -top-1 rounded-full bg-red-500 px-1.5 text-xs text-white">
                {unread}
              </span>
            )}
          </div>
          <span className="text-sm text-slate-600">{user?.name}</span>
          <button
            onClick={() => {
              void logout();
              navigate('/login');
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            Log out
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
        {/* Dashboard footer — company contact details per spec Section 27 */}
        <footer className="border-t border-slate-200 bg-white px-6 py-3 text-xs text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              © {new Date().getFullYear()} {COMPANY.name} ·{' '}
              <a href={`mailto:${COMPANY.email}`} className="text-brand-600 hover:underline">
                {COMPANY.email}
              </a>{' '}
              ·{' '}
              <a href={`tel:${COMPANY.phone.replace(/\s/g, '')}`} className="text-brand-600 hover:underline">
                {COMPANY.phone}
              </a>
            </span>
            <Link to="/tickets" className="text-brand-600 hover:underline">
              Get Support
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
