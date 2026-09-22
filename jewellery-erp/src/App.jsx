import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useApp } from './context/Auth';
import { isConfigured } from './lib/firebase';
import { P, can } from './lib/permissions';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import { ConfigMissing, Denied, LoadError, Login, Setup } from './pages/AuthScreens';
import PublicInvoice from './pages/PublicInvoice';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Billing = lazy(() => import('./pages/Billing'));
const Invoices = lazy(() => import('./pages/Invoices'));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail'));
const Customers = lazy(() => import('./pages/Customers'));
const CustomerProfile = lazy(() => import('./pages/CustomerProfile'));
const Inventory = lazy(() => import('./pages/Inventory'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Branches = lazy(() => import('./pages/Branches'));
const Staff = lazy(() => import('./pages/Staff'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const AuditLog = lazy(() => import('./pages/AuditLog'));

function Guard({ perm, children }) {
  const { profile } = useApp();
  return can(profile, perm) ? children : <div className="alert warn">You do not have access to this screen.</div>;
}

export default function App() {
  const { status } = useApp();
  return (
    <Routes>
      <Route path="/verify/:token" element={<PublicInvoice />} />
      <Route path="*" element={<Shell status={status} />} />
    </Routes>
  );
}

function Shell({ status }) {
  if (!isConfigured) return <ConfigMissing />;
  if (status === 'loading') return <Spinner />;
  if (status === 'setup') return <Setup />;
  if (status === 'anon') return <Login />;
  if (status === 'denied') return <Denied />;
  if (status === 'error') return <LoadError />;

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Guard perm={P.VIEW_DASHBOARD}><Dashboard /></Guard>} />
          <Route path="bill" element={<Guard perm={P.CREATE_BILL}><Billing /></Guard>} />
          <Route path="invoices" element={<Guard perm={P.VIEW_INVOICES}><Invoices /></Guard>} />
          <Route path="invoices/:id" element={<Guard perm={P.VIEW_INVOICES}><InvoiceDetail /></Guard>} />
          <Route path="customers" element={<Guard perm={P.VIEW_CUSTOMERS}><Customers /></Guard>} />
          <Route path="customers/:id" element={<Guard perm={P.VIEW_CUSTOMERS}><CustomerProfile /></Guard>} />
          <Route path="inventory" element={<Guard perm={P.VIEW_STOCK}><Inventory /></Guard>} />
          <Route path="products/:id" element={<Guard perm={P.VIEW_STOCK}><ProductDetail /></Guard>} />
          <Route path="branches" element={<Guard perm={P.MANAGE_BRANCHES}><Branches /></Guard>} />
          <Route path="staff" element={<Guard perm={P.MANAGE_STAFF}><Staff /></Guard>} />
          <Route path="settings" element={<Guard perm={P.MANAGE_SETTINGS}><SettingsPage /></Guard>} />
          <Route path="audit" element={<Guard perm={P.VIEW_AUDIT}><AuditLog /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
