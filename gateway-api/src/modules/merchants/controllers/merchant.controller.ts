import { Request, Response, NextFunction } from 'express';
import { MerchantService } from '../services/merchant.service';
import { sendSuccess } from '../../../utils/response';

const service = new MerchantService();

export class MerchantController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, search, status } = req.query;
      const result = await service.list(+page, +limit, search as string, status as string);
      sendSuccess(res, result.data, 'OK', 200, result.meta);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await service.getById(req.params.id));
    } catch (err) { next(err); }
  }

  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await service.getProfile(req.user!.userId));
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await service.create(req.body), 'Merchant created', 201);
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await service.update(req.params.id, req.body), 'Updated');
    } catch (err) { next(err); }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await service.updateProfile(req.user!.userId, req.body), 'Updated');
    } catch (err) { next(err); }
  }

  async resetWebhookSecret(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await service.resetWebhookSecret(req.params.id), 'Secret reset');
    } catch (err) { next(err); }
  }

  async verifyEmailManually(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.verifyEmailManually(req.params.id);
      sendSuccess(res, null, 'Đã xác thực email cho merchant này');
    } catch (err) { next(err); }
  }

  async getReferrals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await service.getReferrals(req.user!.merchantId!));
    } catch (err) { next(err); }
  }

  async transferReferralBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await service.transferReferralBalance(req.user!.merchantId!);
      sendSuccess(res, result, `Đã chuyển ${result.transferredAmount} USDT vào số dư chính`);
    } catch (err) { next(err); }
  }

  async resetOwnWebhookSecret(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await service.resetOwnWebhookSecret(req.user!.userId), 'Webhook secret đã được làm mới');
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.delete(req.params.id);
      sendSuccess(res, null, 'Deleted');
    } catch (err) { next(err); }
  }

  async getApiKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const merchantId = req.params.merchantId || req.user!.merchantId!;
      sendSuccess(res, await service.getApiKeys(merchantId));
    } catch (err) { next(err); }
  }

  async createApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const merchantId = req.params.merchantId || req.user!.merchantId!;
      sendSuccess(res, await service.createApiKey(merchantId, req.body.name, req.body.environment), 'API key created', 201);
    } catch (err) { next(err); }
  }

  async revokeApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const merchantId = req.params.merchantId || req.user!.merchantId!;
      await service.revokeApiKey(merchantId, req.params.keyId);
      sendSuccess(res, null, 'API key revoked');
    } catch (err) { next(err); }
  }
}
