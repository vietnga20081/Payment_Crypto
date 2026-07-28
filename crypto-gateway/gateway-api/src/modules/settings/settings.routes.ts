import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { prisma } from '../../prisma/client';
import { sendSuccess } from '../../utils/response';
import { testSmtpConfig } from '../../utils/mailer';
import { testTelegramConfig } from '../../utils/telegram-otp';
import { body } from 'express-validator';
import { validate } from '../../middlewares/validation.middleware';
import { Request, Response, NextFunction } from 'express';

const router = Router();

router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.systemSetting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });
    sendSuccess(res, settings);
  } catch (err) { next(err); }
});

router.put('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates: Array<{ key: string; value: string }> = req.body.settings;
    await Promise.all(updates.map(({ key, value }) =>
      prisma.systemSetting.update({ where: { key }, data: { value } })
    ));
    sendSuccess(res, null, 'Settings updated');
  } catch (err) { next(err); }
});

// ── Test cấu hình Tích hợp — dùng giá trị đang gõ trên form, CHƯA cần lưu ──
router.post('/test-smtp', authenticate, authorize('ADMIN', 'SUPER_ADMIN'),
  [
    body('host').notEmpty(),
    body('port').isInt(),
    body('user').notEmpty(),
    body('pass').notEmpty(),
    body('to').isEmail(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await testSmtpConfig(
        { host: req.body.host, port: Number(req.body.port), secure: !!req.body.secure, user: req.body.user, pass: req.body.pass, from: req.body.from },
        req.body.to
      );
      if (!result.success) {
        res.status(400).json({ success: false, message: `Gửi thất bại: ${result.error}` });
        return;
      }
      sendSuccess(res, null, `Đã gửi email test tới ${req.body.to}`);
    } catch (err) { next(err); }
  }
);

router.post('/test-telegram', authenticate, authorize('ADMIN', 'SUPER_ADMIN'),
  [body('botToken').notEmpty(), body('chatId').notEmpty()],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await testTelegramConfig(req.body.botToken, req.body.chatId);
      if (!result.success) {
        res.status(400).json({ success: false, message: `Gửi thất bại: ${result.error}` });
        return;
      }
      sendSuccess(res, null, 'Đã gửi tin nhắn test qua Telegram');
    } catch (err) { next(err); }
  }
);

export default router;
