import { useEffect } from 'react';
import { Routes, Route, Navigate, Link, Outlet } from 'react-router-dom';
import { useAuth, isInternal } from '../lib/auth.store';
import { Login } from '../features/auth/Login';
import { Signup } from '../features/auth/Signup';
import { Landing } from '../features/landing/Landing';
import { ClientShell } from './ClientShell';
import { InternalShell } from './InternalShell';
import { ClientDashboard } from '../features/projects/ClientDashboard';
import { ProductDetail } from '../features/projects/ProductDetail';
import { NewProductRequest } from '../features/projects/NewProductRequest';
import { MonitoringPage } from '../features/monitoring/MonitoringPage';
import { AutomationPage } from '../features/automation/AutomationPage';
import { BillingPage } from '../features/billing/BillingPage';
import { TicketsPage } from '../features/tickets/TicketsPage';
import { AdminDashboard } from '../features/admin/AdminDashboard';
import { AdminProducts } from '../features/admin/AdminProducts';
import { AdminBilling } from '../features/admin/AdminBilling';
import { AdminAudit } from '../features/admin/AdminAudit';

export default function App() {
  const { user, loading, loadSession } = useAuth();

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-pulse text-brand-600 text-lg font-medium">Loading Mugheer…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const internal = isInternal(user);
  return (
    <Routes>
      <Route element={internal ? <InternalShell /> : <ClientShell />}>
        <Route path="/dashboard" element={internal ? <AdminDashboard /> : <ClientDashboard />} />
        <Route path="/projects" element={<Navigate to="/dashboard" replace />} />
        <Route path="/projects/:id" element={<ProductDetail />} />
        <Route path="/projects/new" element={<NewProductRequest />} />
        <Route path="/projects/:id/monitoring" element={<MonitoringPage />} />
        <Route path="/automation" element={<AutomationPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        {internal && <Route path="/admin/products" element={<AdminProducts />} />}
        {internal && <Route path="/admin/billing" element={<AdminBilling />} />}
        {internal && <Route path="/admin/audit" element={<AdminAudit />} />}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export function NotFound() {
  return (
    <div className="p-10 text-center">
      <p className="text-2xl font-semibold text-slate-700">Page not found</p>
      <Link to="/dashboard" className="mt-4 inline-block text-brand-600 hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
