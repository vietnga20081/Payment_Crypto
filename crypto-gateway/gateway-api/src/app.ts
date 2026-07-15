import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { authenticate, authorize } from './middlewares/auth.middleware';
import { webhookQueue } from './jobs/webhook.job';

import authRoutes from './modules/auth/auth.routes';
import merchantRoutes from './modules/merchants/merchant.routes';
import merchantProfileRoutes from './modules/merchants/merchant-profile.routes';
import transactionRoutes from './modules/transactions/transaction.routes';
import payPublicRoutes from './modules/transactions/pay-public.routes';
import withdrawalRoutes from './modules/withdrawals/withdrawal.routes';
import walletRoutes from './modules/wallets/wallet.routes';
import reportsRoutes from './modules/reports/reports.routes';
import settingsRoutes from './modules/settings/settings.routes';
import auditRoutes from './modules/audit/audit.routes';
import twoFARoutes from './modules/twofa/twofa.routes';
import ipWhitelistRoutes from './modules/security/ipwhitelist.routes';
import sweepRoutes from './modules/sweep/sweep.routes';
import reconciliationRoutes from './modules/reconciliation/reconciliation.routes';
import exportRoutes from './modules/export/export.routes';
import permissionRoutes from './modules/permissions/permission.routes';
import referralRoutes from './modules/referral/referral.routes';

const app = express();

app.set('trust proxy', 1); // honor X-Forwarded-For from Nginx for correct client IP

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Bull Board — dashboard theo dõi hàng đợi webhook (chỉ ADMIN/SUPER_ADMIN) ──
const bullBoardAdapter = new ExpressAdapter();
bullBoardAdapter.setBasePath('/api/v1/admin/queues');
createBullBoard({
  // Cast needed: @bull-board/api's bundled bullmq types lag behind the installed
  // bullmq version (JobProgress typing drift) — doesn't affect runtime behavior.
  queues: [new BullMQAdapter(webhookQueue)],
  serverAdapter: bullBoardAdapter,
} as Parameters<typeof createBullBoard>[0]);
app.use('/api/v1/admin/queues', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), bullBoardAdapter.getRouter());

// Public routes (no auth)
app.use('/api/v1/pay', payPublicRoutes);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/2fa', twoFARoutes);
app.use('/api/v1/admin/merchants', merchantRoutes);
app.use('/api/v1/admin/admins', permissionRoutes);
app.use('/api/v1/admin/referral', referralRoutes);
app.use('/api/v1/merchant', merchantProfileRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/withdrawals', withdrawalRoutes);
app.use('/api/v1/wallets', walletRoutes);
app.use('/api/v1/sweep', sweepRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/reconciliation', reconciliationRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/ip-whitelist', ipWhitelistRoutes);
app.use('/api/v1/export', exportRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
