import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { MerchantController } from '../merchants/controllers/merchant.controller';
import { body } from 'express-validator';
import { validate } from '../../middlewares/validation.middleware';

const router = Router();
const ctrl = new MerchantController();

router.get('/profile', authenticate, authorize('MERCHANT'), ctrl.getProfile.bind(ctrl));
router.put('/profile', authenticate, authorize('MERCHANT'), ctrl.updateProfile.bind(ctrl));
router.post('/webhook-secret/reset', authenticate, authorize('MERCHANT'), ctrl.resetOwnWebhookSecret.bind(ctrl));
router.get('/api-keys', authenticate, authorize('MERCHANT'), ctrl.getApiKeys.bind(ctrl));
router.post('/api-keys', authenticate, authorize('MERCHANT'), [body('name').notEmpty()], validate, ctrl.createApiKey.bind(ctrl));
router.delete('/api-keys/:keyId', authenticate, authorize('MERCHANT'), ctrl.revokeApiKey.bind(ctrl));
router.get('/referrals', authenticate, authorize('MERCHANT'), ctrl.getReferrals.bind(ctrl));
router.post('/referrals/transfer-balance', authenticate, authorize('MERCHANT'), ctrl.transferReferralBalance.bind(ctrl));

export default router;
