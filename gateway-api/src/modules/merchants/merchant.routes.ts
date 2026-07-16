import { Router } from 'express';
import { MerchantController } from './controllers/merchant.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { body } from 'express-validator';
import { validate } from '../../middlewares/validation.middleware';

const router = Router();
const ctrl = new MerchantController();

// Admin routes
router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), ctrl.list.bind(ctrl));
router.post('/',
  authenticate, authorize('ADMIN', 'SUPER_ADMIN'),
  [
    body('email').isEmail(),
    body('password').isLength({ min: 8 }),
    body('name').notEmpty(),
    body('feeRate').optional().isFloat({ min: 0, max: 1 }),
  ],
  validate,
  ctrl.create.bind(ctrl)
);
router.get('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), ctrl.getById.bind(ctrl));
router.put('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), ctrl.update.bind(ctrl));
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), ctrl.delete.bind(ctrl));
router.post('/:id/reset-webhook-secret', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), ctrl.resetWebhookSecret.bind(ctrl));
router.post('/:id/verify-email', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), ctrl.verifyEmailManually.bind(ctrl));
router.get('/:merchantId/api-keys', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), ctrl.getApiKeys.bind(ctrl));
router.post('/:merchantId/api-keys', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), [body('name').notEmpty()], validate, ctrl.createApiKey.bind(ctrl));
router.delete('/:merchantId/api-keys/:keyId', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), ctrl.revokeApiKey.bind(ctrl));

export default router;
