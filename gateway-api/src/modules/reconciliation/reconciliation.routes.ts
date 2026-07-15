import { Router, Request, Response, NextFunction } from 'express';
import { ReconciliationService } from './services/reconciliation.service';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { sendSuccess } from '../../utils/response';
import { body, query } from 'express-validator';
import { validate } from '../../middlewares/validation.middleware';

const router = Router();
const service = new ReconciliationService();

// Admin: list all, generate for any merchant
router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, merchantId } = req.query;
    const result = await service.list(merchantId as string, +page, +limit);
    sendSuccess(res, result.data, 'OK', 200, result.meta);
  } catch (e) { next(e); }
});

router.post('/generate', authenticate, authorize('ADMIN', 'SUPER_ADMIN'),
  [body('merchantId').notEmpty(), body('periodStart').isISO8601(), body('periodEnd').isISO8601()], validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { merchantId, periodStart, periodEnd, expectedOrderIds } = req.body;
      const result = await service.generate(merchantId, new Date(periodStart), new Date(periodEnd), expectedOrderIds);
      sendSuccess(res, result, 'Đối soát hoàn tất', 201);
    } catch (e) { next(e); }
  }
);

router.get('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.getDetail(req.params.id)); } catch (e) { next(e); }
});

// Merchant: self-service summary for own records
router.get('/my/summary', authenticate, authorize('MERCHANT'),
  [query('startDate').isISO8601(), query('endDate').isISO8601()], validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;
      const result = await service.getMerchantSummary(req.user!.merchantId!, new Date(startDate as string), new Date(endDate as string));
      sendSuccess(res, result);
    } catch (e) { next(e); }
  }
);

export default router;
