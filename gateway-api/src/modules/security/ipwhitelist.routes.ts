import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../prisma/client';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { sendSuccess } from '../../utils/response';
import { body } from 'express-validator';
import { validate } from '../../middlewares/validation.middleware';
import { NotFoundError } from '../../utils/errors';

const router = Router();

const ipValidator = [
  body('ipAddress').isIP().withMessage('Địa chỉ IP không hợp lệ'),
  body('label').optional().isString(),
];

// ── Merchant self-service ──────────────────────────────────────────────────
router.get('/my', authenticate, authorize('MERCHANT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await prisma.ipWhitelist.findMany({
      where: { merchantId: req.user!.merchantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, list);
  } catch (e) { next(e); }
});

router.post('/my', authenticate, authorize('MERCHANT'), ipValidator, validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entry = await prisma.ipWhitelist.create({
        data: { merchantId: req.user!.merchantId, ipAddress: req.body.ipAddress, label: req.body.label },
      });
      sendSuccess(res, entry, 'Đã thêm IP', 201);
    } catch (e) { next(e); }
  }
);

router.delete('/my/:id', authenticate, authorize('MERCHANT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await prisma.ipWhitelist.findFirst({ where: { id: req.params.id, merchantId: req.user!.merchantId } });
    if (!entry) throw new NotFoundError('IP không tồn tại');
    await prisma.ipWhitelist.update({ where: { id: req.params.id }, data: { isActive: false } });
    sendSuccess(res, null, 'Đã xóa IP');
  } catch (e) { next(e); }
});

router.put('/my/toggle-restriction', authenticate, authorize('MERCHANT'),
  [body('enabled').isBoolean()], validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.merchant.update({
        where: { id: req.user!.merchantId },
        data: { ipRestrictionEnabled: req.body.enabled },
      });
      sendSuccess(res, null, req.body.enabled ? 'Đã bật giới hạn IP' : 'Đã tắt giới hạn IP');
    } catch (e) { next(e); }
  }
);

// ── Admin management (any merchant) ────────────────────────────────────────
router.get('/merchant/:merchantId', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await prisma.ipWhitelist.findMany({
      where: { merchantId: req.params.merchantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, list);
  } catch (e) { next(e); }
});

router.post('/merchant/:merchantId', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), ipValidator, validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entry = await prisma.ipWhitelist.create({
        data: { merchantId: req.params.merchantId, ipAddress: req.body.ipAddress, label: req.body.label },
      });
      sendSuccess(res, entry, 'Đã thêm IP', 201);
    } catch (e) { next(e); }
  }
);

router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.ipWhitelist.update({ where: { id: req.params.id }, data: { isActive: false } });
    sendSuccess(res, null, 'Đã xóa IP');
  } catch (e) { next(e); }
});

export default router;
