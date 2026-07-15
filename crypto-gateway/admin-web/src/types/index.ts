export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'MERCHANT';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type TransactionStatus = 'PENDING' | 'CONFIRMING' | 'COMPLETED' | 'EXPIRED' | 'FAILED';
export type WithdrawalStatus = 'PENDING' | 'APPROVED_L1' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED';
export type WalletType = 'HOT' | 'COLD' | 'MERCHANT' | 'SWEEP';
export type EnvironmentMode = 'LIVE' | 'SANDBOX';
export type NetworkType = 'TRC20' | 'BEP20';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  merchantId?: string;
}

export interface Merchant {
  id: string;
  userId: string;
  name: string;
  website?: string;
  callbackUrl?: string;
  balance: string;
  frozenBalance: string;
  sandboxBalance: string;
  feeRate: string;
  status: UserStatus;
  ipRestrictionEnabled: boolean;
  withdrawal2FARequired: boolean;
  dailyWithdrawalLimit: string;
  webhookSecret?: string;
  createdAt: string;
  user?: { email: string; status: UserStatus; lastLoginAt?: string };
}

export interface Transaction {
  id: string;
  merchantId: string;
  orderId: string;
  txHash?: string;
  amount: string;
  fee: string;
  netAmount: string;
  fromAddress?: string;
  toAddress?: string | null;
  network?: NetworkType | null;
  status: TransactionStatus;
  environment: EnvironmentMode;
  confirmations: number;
  requiredConfirmations: number;
  metadata?: Record<string, unknown>;
  returnUrl?: string;
  expiredAt: string;
  confirmedAt?: string;
  reconciledAt?: string;
  createdAt: string;
  merchant?: { name: string };
}

export interface WithdrawalApproval {
  id: string;
  withdrawalId: string;
  userId: string;
  step: number;
  action: 'APPROVED' | 'REJECTED';
  reason?: string;
  createdAt: string;
  user?: { email: string };
}

export interface Withdrawal {
  id: string;
  merchantId: string;
  toAddress: string;
  amount: string;
  fee: string;
  netAmount: string;
  txHash?: string;
  network: NetworkType;
  status: WithdrawalStatus;
  note?: string;
  requiresDualApproval: boolean;
  processedAt?: string;
  createdAt: string;
  merchant?: { name: string };
  approvals?: WithdrawalApproval[];
}

export interface Wallet {
  id: string;
  address: string;
  type: WalletType;
  network: NetworkType;
  balance: string;
  trxBalance?: string;
  isActive: boolean;
  inRotation: boolean;
  label?: string;
  assignedCount?: number;
  lastAssignedAt?: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  environment: EnvironmentMode;
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

export interface IpWhitelistEntry {
  id: string;
  ipAddress: string;
  label?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Reconciliation {
  id: string;
  merchantId: string;
  periodStart: string;
  periodEnd: string;
  expectedCount: number;
  expectedVolume: string;
  matchedCount: number;
  matchedVolume: string;
  discrepancyCount: number;
  status: string;
  createdAt: string;
  completedAt?: string;
  merchant?: { name: string };
}

export interface SweepLog {
  id: string;
  walletId: string;
  toAddress: string;
  amount: string;
  txHash?: string;
  status: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  wallet?: { address: string; label?: string };
}

export interface AdminPermission {
  resource: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt?: string;
  createdAt: string;
}

export interface LoginAttempt {
  id: string;
  email: string;
  ipAddress: string;
  success: boolean;
  reason?: string;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface HourlyData {
  hour: number;
  count: number;
  completed: number;
  volume: number;
}

export interface TopMerchant {
  merchantId: string;
  name: string;
  volume: number;
  count: number;
}

export interface StatusBreakdown {
  status: string;
  count: number;
}

export interface DashboardStats {
  merchants: { total: number; active: number };
  transactions: {
    total: number; today: number; yesterday: number; todayChange: number;
    completed: number; pending: number; confirming: number;
  };
  revenue: {
    monthVolume: number; monthFee: number;
    lastMonthVolume: number; monthChange: number;
    todayVolume: number; yesterdayVolume: number; todayVolumeChange: number;
  };
  withdrawals: { pending: number; processing: number };
  hourlyChart: HourlyData[];
  topMerchants: TopMerchant[];
  statusBreakdown: StatusBreakdown[];
}
