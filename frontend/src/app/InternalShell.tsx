import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.store';

const NAV = [
  { to: '/dashboard', label: 'Console', end: true },
  { to: '/admin/products', label: 'Products' },
  { to: '/tickets', label: 'Tickets' },
  { to: '/automation', label: 'Runbooks' },
  { to: '/admin/billing', label: 'Billing' },
  { to: '/admin/audit', label: 'Audit Log' },
];

export function InternalShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-slate-900 text-slate-100">
        <div className="flex h-16 items-center border-b border-slate-700 px-5">
          <span className="text-xl font-bold">Mugheer</span>
          <span className="ml-2 rounded bg-brand-600 px-1.5 py-0.5 text-xs">internal</span>
        </div>
        <nav className="flex flex-col gap-1 p-3" aria-label="Admin navigation">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800'
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
          <span className="text-sm text-slate-600">
            {user?.name} · <span className="font-medium text-slate-800">{user?.role}</span>
          </span>
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
      </div>
    </div>
  );
}
