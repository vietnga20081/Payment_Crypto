import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { ReportsService } from './services/reports.service';
import { sendSuccess } from '../../utils/response';
import { Request, Response, NextFunction } from 'express';

const router = Router();
const service = new ReportsService();

router.get('/dashboard', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await service.getDashboardStats());
  } catch (err) { next(err); }
});

router.get('/trend', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { days = 30, merchantId } = req.query;
    const mid = req.user?.role === 'MERCHANT' ? req.user.merchantId : merchantId as string | undefined;
    sendSuccess(res, await service.getTrend(Number(days), mid));
  } catch (err) { next(err); }
});

router.get('/merchant-dashboard', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.user?.role === 'MERCHANT'
      ? req.user.merchantId!
      : req.query.merchantId as string;
    sendSuccess(res, await service.getMerchantDashboard(merchantId));
  } catch (err) { next(err); }
});

router.get('/revenue', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, merchantId } = req.query;
    if (!startDate || !endDate) {
      res.status(400).json({ success: false, message: 'startDate and endDate required' });
      return;
    }
    sendSuccess(res, await service.getRevenue(startDate as string, endDate as string, merchantId as string));
  } catch (err) { next(err); }
});

export default router;
