import { Request, Response, NextFunction } from 'express';
import { TransactionService } from '../services/transaction.service';
import { sendSuccess } from '../../../utils/response';

const service = new TransactionService();

export class TransactionController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, status, search, startDate, endDate } = req.query;
      const merchantId = req.user?.role === 'MERCHANT' ? req.user.merchantId : (req.query.merchantId as string);
      const result = await service.list({
        page: +page, limit: +limit, merchantId, status: status as string,
        search: search as string, startDate: startDate as string, endDate: endDate as string,
      });
      sendSuccess(res, result.data, 'OK', 200, result.meta);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await service.getById(req.params.id));
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const merchantId = req.user!.merchantId!;
      const environment = req.apiEnvironment || 'LIVE';
      const { network, ...rest } = req.body;
      const result = await service.create(merchantId, { ...rest, network }, environment);
      sendSuccess(res, result, 'Payment request created', 201);
    } catch (err) { next(err); }
  }

  async simulateSandbox(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const merchantId = req.user!.merchantId!;
      const result = await service.simulateSandboxComplete(merchantId, req.params.id);
      sendSuccess(res, result, 'Sandbox transaction marked completed');
    } catch (err) { next(err); }
  }

  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const merchantId = req.user?.role === 'MERCHANT' ? req.user.merchantId : undefined;
      sendSuccess(res, await service.getStats(merchantId));
    } catch (err) { next(err); }
  }
}
