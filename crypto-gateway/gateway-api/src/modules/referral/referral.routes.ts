import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { sendSuccess } from '../../utils/response';
import { ReferralAdminService } from './services/referral-admin.service';

const router = Router();
const service = new ReferralAdminService();

router.get('/settings', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await service.getSettings());
  } catch (err) { next(err); }
});

router.put('/settings', authenticate, authorize('SUPER_ADMIN'),
  [
    body('enabled').isBoolean(),
    body('commissionRate').isFloat({ min: 0, max: 1 }),
    body('durationDays').isInt({ min: 0 }),
    body('dailyCap').isFloat({ min: 0 }),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await service.updateSettings(req.body), 'Đã cập nhật cấu hình giới thiệu');
    } catch (err) { next(err); }
  }
);

router.get('/stats', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await service.getStats());
  } catch (err) { next(err); }
});

export default router;
