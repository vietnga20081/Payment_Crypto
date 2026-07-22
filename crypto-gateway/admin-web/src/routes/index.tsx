import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import AdminLayout from '../layouts/AdminLayout';
import MerchantLayout from '../layouts/MerchantLayout';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import VerifyEmailPage from '../pages/auth/VerifyEmailPage';
import PaymentPage from '../pages/pay/PaymentPage';

// Admin pages
import AdminDashboard from '../pages/admin/Dashboard';
import MerchantsPage from '../pages/admin/Merchants';
import AdminTransactionsPage from '../pages/admin/Transactions';
import AdminWithdrawalsPage from '../pages/admin/Withdrawals';
import WalletsPage from '../pages/admin/Wallets';
import SweepPage from '../pages/admin/Sweep';
import ReconciliationPage from '../pages/admin/Reconciliation';
import ReportsPage from '../pages/admin/Reports';
import SettingsPage from '../pages/admin/Settings';
import AuditLogsPage from '../pages/admin/AuditLogs';
import AdminManagementPage from '../pages/admin/AdminManagement';
import ReferralSettingsPage from '../pages/admin/ReferralSettings';

// Merchant pages
import MerchantDashboard from '../pages/merchant/Dashboard';
import MerchantTransactionsPage from '../pages/merchant/Transactions';
import MerchantWithdrawalsPage from '../pages/merchant/Withdrawals';
import ApiKeysPage from '../pages/merchant/ApiKeys';
import MerchantProfilePage from '../pages/merchant/Profile';
import SandboxPage from '../pages/merchant/Sandbox';
import MerchantReconciliationPage from '../pages/merchant/Reconciliation';
import ApiDocsPage from '../pages/merchant/ApiDocs';
import ReferralPage from '../pages/merchant/Referral';
import WebhookLogsPage from '../pages/merchant/WebhookLogs';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'];

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode; roles?: string[] }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  { path: '/pay/:transactionId', element: <PaymentPage /> },
  {
    path: '/admin',
    element: <ProtectedRoute roles={ADMIN_ROLES}><AdminLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'dashboard', element: <AdminDashboard /> },
      { path: 'merchants', element: <MerchantsPage /> },
      { path: 'transactions', element: <AdminTransactionsPage /> },
      { path: 'withdrawals', element: <AdminWithdrawalsPage /> },
      { path: 'wallets', element: <WalletsPage /> },
      { path: 'sweep', element: <SweepPage /> },
      { path: 'reconciliation', element: <ReconciliationPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'referral', element: <ReferralSettingsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'audit-logs', element: <AuditLogsPage /> },
      { path: 'admins', element: <ProtectedRoute roles={['SUPER_ADMIN']}><AdminManagementPage /></ProtectedRoute> },
    ],
  },
  {
    path: '/merchant',
    element: <ProtectedRoute roles={['MERCHANT']}><MerchantLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <Navigate to="/merchant/dashboard" replace /> },
      { path: 'dashboard', element: <MerchantDashboard /> },
      { path: 'transactions', element: <MerchantTransactionsPage /> },
      { path: 'withdrawals', element: <MerchantWithdrawalsPage /> },
      { path: 'api-keys', element: <ApiKeysPage /> },
      { path: 'sandbox', element: <SandboxPage /> },
      { path: 'reconciliation', element: <MerchantReconciliationPage /> },
      { path: 'api-docs', element: <ApiDocsPage /> },
      { path: 'referral', element: <ReferralPage /> },
      { path: 'webhook-logs', element: <WebhookLogsPage /> },
      { path: 'profile', element: <MerchantProfilePage /> },
    ],
  },
]);

export default router;
