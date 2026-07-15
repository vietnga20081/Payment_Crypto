import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { WalletService } from './services/wallet.service';
import { WalletRotationService } from './services/wallet-rotation.service';
import { ExportKeyService } from './services/export-key.service';
import { sendSuccess } from '../../utils/response';
import { NextFunction, Request, Response } from 'express';
import { body } from 'express-validator';
import { validate } from '../../middlewares/validation.middleware';
import { WalletType, NetworkType } from '@prisma/client';

const router = Router();
const service = new WalletService();
const rotation = new WalletRotationService();
const exportKeyService = new ExportKeyService();

// Giới hạn riêng cho export-key: nhạy cảm hơn nhiều so với các API khác
const exportKeyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, network } = req.query;
    const result = await service.list(+page, +limit, network as NetworkType | undefined);
    sendSuccess(res, result.data, 'OK', 200, result.meta);
  } catch (err) { next(err); }
});

router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'),
  [body('network').optional().isIn(['TRC20', 'BEP20'])],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const network = (req.body.network as NetworkType) || NetworkType.TRC20;
      sendSuccess(res, await service.create(req.body.label, req.body.type as WalletType, network), 'Wallet created', 201);
    } catch (err) { next(err); }
  }
);

router.get('/:id/balance', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await service.getBalance(req.params.id));
  } catch (err) { next(err); }
});

// ── Rotation management ──────────────────────────────────────────────────
router.get('/rotation/stats', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await rotation.getRotationStats()); } catch (err) { next(err); }
});

router.put('/:id/rotation', authenticate, authorize('ADMIN', 'SUPER_ADMIN'),
  [body('inRotation').isBoolean()], validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await rotation.setRotationStatus(req.params.id, req.body.inRotation), 'Đã cập nhật trạng thái rotation');
    } catch (err) { next(err); }
  }
);

router.post('/:walletId/pin/:merchantId', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await rotation.pinWalletToMerchant(req.params.merchantId, req.params.walletId), 'Đã gán ví cố định cho merchant');
  } catch (err) { next(err); }
});

router.delete('/:walletId/pin/:merchantId', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await rotation.unpinWallet(req.params.merchantId, req.params.walletId);
    sendSuccess(res, null, 'Đã gỡ gán ví');
  } catch (err) { next(err); }
});

// ── Export private key — bắt buộc xác thực 2 kênh Telegram + Email ──────
router.post('/:id/export-key/request', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), exportKeyLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await exportKeyService.requestExport(req.user!.userId, req.params.id);
      sendSuccess(res, result, 'Đã gửi OTP qua Telegram và Email');
    } catch (err) { next(err); }
  }
);

router.post('/:id/export-key/verify', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), exportKeyLimiter,
  [
    body('requestId').notEmpty(),
    body('telegramCode').isLength({ min: 6, max: 6 }),
    body('emailCode').isLength({ min: 6, max: 6 }),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await exportKeyService.verifyAndExport(
        req.user!.userId,
        req.body.requestId,
        req.body.telegramCode,
        req.body.emailCode,
        req.ip,
        req.headers['user-agent']
      );
      sendSuccess(res, result, 'Xác thực thành công');
    } catch (err) { next(err); }
  }
);

export default router;
