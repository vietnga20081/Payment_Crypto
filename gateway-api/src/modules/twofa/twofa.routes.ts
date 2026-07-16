import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { TwoFAService } from './services/twofa.service';
import { authenticate } from '../../middlewares/auth.middleware';
import { sendSuccess } from '../../utils/response';
import { body } from 'express-validator';
import { validate } from '../../middlewares/validation.middleware';

const router = Router();
const service = new TwoFAService();

router.get('/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.status(req.user!.userId)); } catch (e) { next(e); }
});

router.post('/setup', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.generateSecret(req.user!.userId, req.user!.email);
    sendSuccess(res, result, 'Quét mã QR bằng Google Authenticator');
  } catch (e) { next(e); }
});

router.post('/enable', authenticate,
  [body('token').isLength({ min: 6, max: 6 })], validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.verifyAndEnable(req.user!.userId, req.body.token);
      sendSuccess(res, result, '2FA đã kích hoạt — lưu lại backup codes!');
    } catch (e) { next(e); }
  }
);

router.post('/disable', authenticate,
  [body('password').notEmpty()], validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await service.disable(req.user!.userId, req.body.password, bcrypt.compare);
      sendSuccess(res, null, '2FA đã tắt');
    } catch (e) { next(e); }
  }
);

router.post('/verify', authenticate,
  [body('token').notEmpty()], validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const valid = await service.verify(req.user!.userId, req.body.token);
      sendSuccess(res, { valid });
    } catch (e) { next(e); }
  }
);

export default router;
export { TwoFAService };
