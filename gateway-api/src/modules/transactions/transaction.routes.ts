import { Router } from 'express';
import { TransactionController } from './controllers/transaction.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { apiKeyAuth } from '../../middlewares/apikey.middleware';
import { merchantRateLimit } from '../../middlewares/ratelimit.middleware';
import { idempotency } from '../../middlewares/idempotency.middleware';
import { body } from 'express-validator';
import { validate } from '../../middlewares/validation.middleware';

const router = Router();
const ctrl = new TransactionController();

router.get('/stats', authenticate, ctrl.getStats.bind(ctrl));
router.get('/', authenticate, ctrl.list.bind(ctrl));
router.get('/:id', authenticate, ctrl.getById.bind(ctrl));

// Merchant API (via API Key) — rate-limited per merchant: 60 req / 60s
router.post('/pay',
  apiKeyAuth,
  merchantRateLimit({ windowSec: 60, max: 60 }),
  idempotency(),
  [
    body('orderId').notEmpty(),
    body('amount').isFloat({ min: 1 }),
    body('network').optional().isIn(['TRC20', 'BEP20']),
    body('returnUrl').optional().isURL(),
  ],
  validate,
  ctrl.create.bind(ctrl)
);

// Sandbox-only: merchant manually triggers completion to test their webhook integration
router.post('/sandbox/:id/simulate-complete', authenticate, authorize('MERCHANT'), ctrl.simulateSandbox.bind(ctrl));

export default router;
