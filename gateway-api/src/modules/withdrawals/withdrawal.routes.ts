import { Router } from 'express';
import { WithdrawalController } from './controllers/withdrawal.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { body } from 'express-validator';
import { validate } from '../../middlewares/validation.middleware';

const router = Router();
const ctrl = new WithdrawalController();

router.get('/', authenticate, ctrl.list.bind(ctrl));
router.post('/',
  authenticate, authorize('MERCHANT'),
  [body('toAddress').notEmpty(), body('amount').isFloat({ min: 1 }), body('network').optional().isIn(['TRC20', 'BEP20'])],
  validate,
  ctrl.create.bind(ctrl)
);
router.post('/:id/approve', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), ctrl.approve.bind(ctrl));
router.post('/:id/reject', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), ctrl.reject.bind(ctrl));
router.post('/:id/complete', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), [body('txHash').notEmpty()], validate, ctrl.markCompleted.bind(ctrl));
router.post('/:id/retry-payout', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), ctrl.retryPayout.bind(ctrl));

export default router;
