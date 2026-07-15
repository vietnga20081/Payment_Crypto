import { Router, Request, Response, NextFunction } from 'express';
import { ExportService } from './services/export.service';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = Router();
const service = new ExportService();

router.get('/transactions/excel', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'OPERATOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { merchantId, status, startDate, endDate } = req.query;
    await service.exportTransactionsExcel(res, {
      merchantId: merchantId as string, status: status as string,
      startDate: startDate as string, endDate: endDate as string,
    });
  } catch (e) { next(e); }
});

router.get('/transactions/pdf', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'OPERATOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { merchantId, status, startDate, endDate } = req.query;
    await service.exportTransactionsPdf(res, {
      merchantId: merchantId as string, status: status as string,
      startDate: startDate as string, endDate: endDate as string,
    });
  } catch (e) { next(e); }
});

// Merchant self-export (scoped to own merchantId automatically)
router.get('/my-transactions/excel', authenticate, authorize('MERCHANT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, startDate, endDate } = req.query;
    await service.exportTransactionsExcel(res, {
      merchantId: req.user!.merchantId, status: status as string,
      startDate: startDate as string, endDate: endDate as string,
    });
  } catch (e) { next(e); }
});

export default router;
