import { Router, Request, Response, NextFunction } from 'express';
import { SweepService } from './services/sweep.service';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { sendSuccess, getPaginationMeta } from '../../utils/response';

const router = Router();
const service = new SweepService();

router.get('/history', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await service.getSweepHistory(+page, +limit);
    sendSuccess(res, result.data, 'OK', 200, getPaginationMeta(result.total, +page, +limit));
  } catch (e) { next(e); }
});

router.post('/wallet/:walletId', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.sweepWallet(req.params.walletId, Number(req.body.minAmount) || 50);
    sendSuccess(res, result, result.swept ? 'Sweep thành công' : 'Số dư chưa đủ ngưỡng sweep');
  } catch (e) { next(e); }
});

router.post('/run-all', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await service.sweepAllEligible(Number(req.body.threshold) || 500);
    sendSuccess(res, results, `Đã xử lý ${results.length} ví`);
  } catch (e) { next(e); }
});

export default router;
