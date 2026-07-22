import api from './api';
import type {
  ApiResponse, Merchant, Transaction, Withdrawal, Wallet, ApiKey, DashboardStats, PaginationMeta,
  IpWhitelistEntry, Reconciliation, SweepLog, AdminPermission, AdminUser, LoginAttempt, NetworkType,
} from '../types';

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authService = {
  login: (email: string, password: string, twoFactorToken?: string) =>
    api.post<ApiResponse<{ requiresTwoFactor?: boolean; accessToken?: string; refreshToken?: string; user?: { id: string; email: string; role: string } }>>(
      '/auth/login', { email, password, twoFactorToken }
    ),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/change-password', { currentPassword, newPassword }),
  loginHistory: () => api.get<ApiResponse<LoginAttempt[]>>('/auth/login-history'),
  getSessions: () => api.get<ApiResponse<Array<{
    id: string; device: string; ipAddress: string | null; createdAt: string; lastUsedAt: string; expiresAt: string;
  }>>>('/auth/sessions'),
  revokeSession: (sessionId: string) => api.delete<ApiResponse<null>>(`/auth/sessions/${sessionId}`),
  revokeAllSessions: () => api.post<ApiResponse<null>>('/auth/sessions/revoke-all'),
  getTelegramChatId: () => api.get<ApiResponse<{ telegramChatId: string | null }>>('/auth/telegram-chat-id'),
  updateTelegramChatId: (telegramChatId: string) => api.put<ApiResponse<null>>('/auth/telegram-chat-id', { telegramChatId }),
  register: (data: { email: string; password: string; merchantName: string; website?: string; referralCode?: string }) =>
    api.post<ApiResponse<{ email: string; merchantName: string }>>('/auth/register', data),
  verifyEmail: (token: string) => api.post<ApiResponse<null>>('/auth/verify-email', { token }),
  resendVerification: (email: string) => api.post<ApiResponse<null>>('/auth/resend-verification', { email }),
};

// ── 2FA ──────────────────────────────────────────────────────────────────────
export const twoFAService = {
  status: () => api.get<ApiResponse<{ enabled: boolean }>>('/2fa/status'),
  setup: () => api.post<ApiResponse<{ secret: string; qrCodeUrl: string }>>('/2fa/setup'),
  enable: (token: string) => api.post<ApiResponse<{ backupCodes: string[] }>>('/2fa/enable', { token }),
  disable: (password: string) => api.post('/2fa/disable', { password }),
};

// ── Merchants ────────────────────────────────────────────────────────────────
export const merchantService = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get<ApiResponse<Merchant[]> & { meta: PaginationMeta }>('/admin/merchants', { params }),
  getById: (id: string) => api.get<ApiResponse<Merchant>>(`/admin/merchants/${id}`),
  create: (data: { email: string; password: string; name: string; feeRate?: number; website?: string; callbackUrl?: string }) =>
    api.post<ApiResponse<Merchant>>('/admin/merchants', data),
  update: (id: string, data: Partial<Merchant>) => api.put<ApiResponse<Merchant>>(`/admin/merchants/${id}`, data),
  delete: (id: string) => api.delete(`/admin/merchants/${id}`),
  resetWebhookSecret: (id: string) => api.post<ApiResponse<{ webhookSecret: string }>>(`/admin/merchants/${id}/reset-webhook-secret`),
  getApiKeys: (merchantId: string) => api.get<ApiResponse<ApiKey[]>>(`/admin/merchants/${merchantId}/api-keys`),
  createApiKey: (merchantId: string, name: string) =>
    api.post<ApiResponse<{ key: string; secret: string; name: string }>>(`/admin/merchants/${merchantId}/api-keys`, { name }),
  revokeApiKey: (merchantId: string, keyId: string) => api.delete(`/admin/merchants/${merchantId}/api-keys/${keyId}`),

  // Merchant self-service
  getProfile: () => api.get<ApiResponse<Merchant>>('/merchant/profile'),
  updateProfile: (data: Partial<Merchant>) => api.put<ApiResponse<Merchant>>('/merchant/profile', data),
  getMyApiKeys: () => api.get<ApiResponse<ApiKey[]>>('/merchant/api-keys'),
  createMyApiKey: (name: string, environment: 'LIVE' | 'SANDBOX' = 'LIVE') =>
    api.post<ApiResponse<{ key: string; secret: string; environment: string }>>('/merchant/api-keys', { name, environment }),
  revokeMyApiKey: (keyId: string) => api.delete(`/merchant/api-keys/${keyId}`),
  resetMyWebhookSecret: () => api.post<ApiResponse<{ webhookSecret: string }>>('/merchant/webhook-secret/reset'),
  getReferrals: () => api.get<ApiResponse<{
    referralCode: string;
    referrals: Array<{ id: string; name: string; status: string; createdAt: string; user: { email: string } }>;
    totalCommissionEarned: string | number;
    commissionHistory: Array<{ id: string; amount: string; commissionRate: string; createdAt: string; referred: { name: string } }>;
  }>>('/merchant/referrals'),
  transferReferralBalance: () => api.post<ApiResponse<{ transferredAmount: string | number }>>('/merchant/referrals/transfer-balance'),
  getWebhookLogs: (params?: { page?: number; limit?: number; transactionId?: string }) =>
    api.get<ApiResponse<Array<{
      id: string; transactionId: string; attempt: number; url: string; success: boolean;
      statusCode: number | null; responseBody: string | null; errorMessage: string | null;
      durationMs: number | null; createdAt: string;
      transaction: { orderId: string; status: string };
    }>> & { meta: PaginationMeta }>('/merchant/webhooks', { params }),
  resendWebhook: (transactionId: string) => api.post<ApiResponse<null>>(`/merchant/webhooks/${transactionId}/resend`),
};

// ── Transactions ─────────────────────────────────────────────────────────────
export const transactionService = {
  list: (params?: { page?: number; limit?: number; status?: string; search?: string; merchantId?: string; startDate?: string; endDate?: string }) =>
    api.get<ApiResponse<Transaction[]> & { meta: PaginationMeta }>('/transactions', { params }),
  getById: (id: string) => api.get<ApiResponse<Transaction>>(`/transactions/${id}`),
  getStats: () => api.get<ApiResponse<{ total: number; todayCount: number; completed: number; pending: number; totalVolume: string }>>('/transactions/stats'),
  simulateSandboxComplete: (id: string) => api.post<ApiResponse<Transaction>>(`/transactions/sandbox/${id}/simulate-complete`),
};

// ── Withdrawals ──────────────────────────────────────────────────────────────
export const withdrawalService = {
  list: (params?: { page?: number; limit?: number; status?: string; merchantId?: string }) =>
    api.get<ApiResponse<Withdrawal[]> & { meta: PaginationMeta }>('/withdrawals', { params }),
  create: (data: { toAddress: string; amount: number; note?: string; network?: NetworkType }) =>
    api.post<ApiResponse<Withdrawal>>('/withdrawals', data),
  approve: (id: string) => api.post(`/withdrawals/${id}/approve`),
  reject: (id: string, reason?: string) => api.post(`/withdrawals/${id}/reject`, { reason }),
  markCompleted: (id: string, txHash: string) => api.post(`/withdrawals/${id}/complete`, { txHash }),
  retryPayout: (id: string) => api.post<ApiResponse<Withdrawal>>(`/withdrawals/${id}/retry-payout`),
};

// ── Wallets ──────────────────────────────────────────────────────────────────
export const walletService = {
  list: (params?: { page?: number; limit?: number; network?: NetworkType }) =>
    api.get<ApiResponse<Wallet[]> & { meta: PaginationMeta }>('/wallets', { params }),
  create: (data: { label?: string; type?: string; network?: NetworkType }) => api.post<ApiResponse<Wallet>>('/wallets', data),
  requestExportKey: (walletId: string) =>
    api.post<ApiResponse<{ requestId: string; expiresInSeconds: number }>>(`/wallets/${walletId}/export-key/request`),
  verifyExportKey: (walletId: string, requestId: string, telegramCode: string, emailCode: string) =>
    api.post<ApiResponse<{ address: string; network: string; privateKey: string }>>(
      `/wallets/${walletId}/export-key/verify`, { requestId, telegramCode, emailCode }
    ),
  getBalance: (id: string) => api.get<ApiResponse<{ address: string; balance: string }>>(`/wallets/${id}/balance`),
  getRotationStats: () => api.get<ApiResponse<Wallet[]>>('/wallets/rotation/stats'),
  setRotation: (id: string, inRotation: boolean) => api.put(`/wallets/${id}/rotation`, { inRotation }),
  pinToMerchant: (walletId: string, merchantId: string) => api.post(`/wallets/${walletId}/pin/${merchantId}`),
  unpinFromMerchant: (walletId: string, merchantId: string) => api.delete(`/wallets/${walletId}/pin/${merchantId}`),
};

// ── Sweep ────────────────────────────────────────────────────────────────────
export const sweepService = {
  history: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<SweepLog[]> & { meta: PaginationMeta }>('/sweep/history', { params }),
  sweepWallet: (walletId: string, minAmount?: number) =>
    api.post<ApiResponse<{ swept: boolean; txHash?: string; amount?: number }>>(`/sweep/wallet/${walletId}`, { minAmount }),
  runAll: (threshold?: number) => api.post<ApiResponse<unknown[]>>('/sweep/run-all', { threshold }),
};

// ── Reconciliation ───────────────────────────────────────────────────────────
export const reconciliationService = {
  list: (params?: { page?: number; limit?: number; merchantId?: string }) =>
    api.get<ApiResponse<Reconciliation[]> & { meta: PaginationMeta }>('/reconciliation', { params }),
  generate: (data: { merchantId: string; periodStart: string; periodEnd: string; expectedOrderIds?: string[] }) =>
    api.post<ApiResponse<Reconciliation>>('/reconciliation/generate', data),
  getDetail: (id: string) => api.get<ApiResponse<Reconciliation & { transactions: Transaction[] }>>(`/reconciliation/${id}`),
  myMummary: (startDate: string, endDate: string) =>
    api.get<ApiResponse<{ transactions: unknown[]; totalVolume: number; totalFee: number; count: number }>>('/reconciliation/my/summary', { params: { startDate, endDate } }),
};

// ── Reports ──────────────────────────────────────────────────────────────────
export const reportService = {
  getDashboard: () => api.get<ApiResponse<DashboardStats>>('/reports/dashboard'),
  getTrend: (days = 30, merchantId?: string) =>
    api.get<ApiResponse<Array<{ date: string; volume: number; fee: number; count: number }>>>('/reports/trend', { params: { days, merchantId } }),
  getMerchantDashboard: (merchantId?: string) =>
    api.get<ApiResponse<{
      transactions: { total: number; today: number; completed: number; pending: number };
      revenue: { monthVolume: number; monthNetAmount: number; monthFee: number };
      balance: number; frozenBalance: number; feeRate: number;
    }>>('/reports/merchant-dashboard', { params: { merchantId } }),
  getRevenue: (startDate: string, endDate: string, merchantId?: string) =>
    api.get<ApiResponse<{ daily: Array<{ date: string; volume: number; fee: number; count: number }>; totalVolume: number; totalFee: number; totalTransactions: number }>>
      ('/reports/revenue', { params: { startDate, endDate, merchantId } }),
};

// ── Settings ──────────────────────────────────────────────────────────────────
// ── Referral (Admin) ──────────────────────────────────────────────────────────
export const referralAdminService = {
  getSettings: () => api.get<ApiResponse<{ enabled: boolean; commissionRate: number; durationDays: number; dailyCap: number }>>('/admin/referral/settings'),
  updateSettings: (data: { enabled: boolean; commissionRate: number; durationDays: number; dailyCap: number }) =>
    api.put<ApiResponse<{ enabled: boolean; commissionRate: number; durationDays: number; dailyCap: number }>>('/admin/referral/settings', data),
  getStats: () => api.get<ApiResponse<{
    totalCommissionPaid: string | number;
    totalReferralRelations: number;
    totalCommissionRows: number;
    leaderboard: Array<{ merchantId: string; merchantName: string; merchantEmail: string; referralCode: string; totalCommission: string | number; commissionCount: number }>;
    suspiciousAttempts: Array<{ id: string; ipAddress: string | null; createdAt: string; detail: { referralCode?: string; referrerMerchantId?: string; email?: string } | null }>;
  }>>('/admin/referral/stats'),
};

export const settingsService = {
  list: () => api.get<ApiResponse<Array<{ id: string; key: string; value: string; type: string; group: string }>>>('/settings'),
  update: (settings: Array<{ key: string; value: string }>) => api.put('/settings', { settings }),
  testSmtp: (data: { host: string; port: number; secure: boolean; user: string; pass: string; from?: string; to: string }) =>
    api.post<ApiResponse<null>>('/settings/test-smtp', data),
  testTelegram: (data: { botToken: string; chatId: string }) =>
    api.post<ApiResponse<null>>('/settings/test-telegram', data),
};

// ── Audit Logs ────────────────────────────────────────────────────────────────
export const auditService = {
  list: (params?: { page?: number; limit?: number; action?: string; resource?: string }) =>
    api.get<ApiResponse<unknown[]> & { meta: PaginationMeta }>('/audit-logs', { params }),
};

// ── IP Whitelist ──────────────────────────────────────────────────────────────
export const ipWhitelistService = {
  myList: () => api.get<ApiResponse<IpWhitelistEntry[]>>('/ip-whitelist/my'),
  myAdd: (ipAddress: string, label?: string) => api.post<ApiResponse<IpWhitelistEntry>>('/ip-whitelist/my', { ipAddress, label }),
  myRemove: (id: string) => api.delete(`/ip-whitelist/my/${id}`),
  toggleRestriction: (enabled: boolean) => api.put('/ip-whitelist/my/toggle-restriction', { enabled }),
  adminList: (merchantId: string) => api.get<ApiResponse<IpWhitelistEntry[]>>(`/ip-whitelist/merchant/${merchantId}`),
  adminAdd: (merchantId: string, ipAddress: string, label?: string) =>
    api.post<ApiResponse<IpWhitelistEntry>>(`/ip-whitelist/merchant/${merchantId}`, { ipAddress, label }),
  adminRemove: (id: string) => api.delete(`/ip-whitelist/${id}`),
};

// ── Export ────────────────────────────────────────────────────────────────────
const downloadFile = async (url: string, params: Record<string, string | undefined>, filename: string) => {
  const res = await api.get(url, { params, responseType: 'blob' });
  const blob = new Blob([res.data as BlobPart]);
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(link.href);
};

export const exportService = {
  transactionsExcel: (params: { merchantId?: string; status?: string; startDate?: string; endDate?: string }) =>
    downloadFile('/export/transactions/excel', params, `transactions_${Date.now()}.xlsx`),
  transactionsPdf: (params: { merchantId?: string; status?: string; startDate?: string; endDate?: string }) =>
    downloadFile('/export/transactions/pdf', params, `transactions_${Date.now()}.pdf`),
  myTransactionsExcel: (params: { status?: string; startDate?: string; endDate?: string }) =>
    downloadFile('/export/my-transactions/excel', params, `my_transactions_${Date.now()}.xlsx`),
};

// ── Admin Management (Super Admin only) ─────────────────────────────────────
export const adminManagementService = {
  list: () => api.get<ApiResponse<AdminUser[]>>('/admin/admins'),
  create: (data: { email: string; password: string; role: 'ADMIN' | 'OPERATOR' }) =>
    api.post<ApiResponse<AdminUser>>('/admin/admins', data),
  update: (id: string, data: { email?: string; role?: 'ADMIN' | 'OPERATOR' }) =>
    api.put<ApiResponse<AdminUser>>(`/admin/admins/${id}`, data),
  remove: (id: string) => api.delete<ApiResponse<null>>(`/admin/admins/${id}`),
  resetPassword: (id: string, newPassword: string) =>
    api.put<ApiResponse<null>>(`/admin/admins/${id}/reset-password`, { newPassword }),
  setStatus: (id: string, status: string) => api.put(`/admin/admins/${id}/status`, { status }),
  getPermissions: (id: string) => api.get<ApiResponse<AdminPermission[]>>(`/admin/admins/${id}/permissions`),
  setPermissions: (id: string, permissions: AdminPermission[]) =>
    api.put<ApiResponse<AdminPermission[]>>(`/admin/admins/${id}/permissions`, { permissions }),
};
