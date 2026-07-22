import { Request, Response, NextFunction } from 'express';
import { WithdrawalService } from '../services/withdrawal.service';
import { sendSuccess } from '../../../utils/response';

const service = new WithdrawalService();

export class WithdrawalController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const merchantId = req.user?.role === 'MERCHANT' ? req.user.merchantId : (req.query.merchantId as string);
      const result = await service.list({ page: +page, limit: +limit, merchantId, status: status as string });
      sendSuccess(res, result.data, 'OK', 200, result.meta);
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await service.create(req.user!.merchantId!, req.body), 'Withdrawal requested', 201);
    } catch (err) { next(err); }
  }

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await service.approve(req.params.id, req.user!.userId), 'Đã duyệt');
    } catch (err) { next(err); }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.reject(req.params.id, req.user!.userId, req.body.reason);
      sendSuccess(res, null, 'Đã từ chối');
    } catch (err) { next(err); }
  }

  async markCompleted(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await service.markCompleted(req.params.id, req.body.txHash), 'Đã hoàn thành');
    } catch (err) { next(err); }
  }

  async retryPayout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await service.retryPayout(req.params.id), 'Đã thử lại payout');
    } catch (err) { next(err); }
  }
}
