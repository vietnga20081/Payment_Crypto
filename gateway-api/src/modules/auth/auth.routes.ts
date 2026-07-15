import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { AuthController } from './controllers/auth.controller';
import { loginValidator, refreshValidator, changePasswordValidator } from './validators/auth.validator';
import { validate } from '../../middlewares/validation.middleware';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();
const ctrl = new AuthController();

// Chống spam đăng ký / gửi lại email xác thực
const publicAuthLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

router.post('/login', loginValidator, validate, ctrl.login.bind(ctrl));
router.post('/register', publicAuthLimiter,
  [
    body('email').isEmail(),
    body('password').isLength({ min: 8 }).withMessage('Mật khẩu tối thiểu 8 ký tự'),
    body('merchantName').notEmpty().withMessage('Vui lòng nhập tên Đại lý'),
    body('website').optional().isURL(),
    body('referralCode').optional().isString(),
  ],
  validate,
  ctrl.register.bind(ctrl)
);
router.post('/verify-email', publicAuthLimiter, [body('token').notEmpty()], validate, ctrl.verifyEmail.bind(ctrl));
router.post('/resend-verification', publicAuthLimiter, [body('email').isEmail()], validate, ctrl.resendVerification.bind(ctrl));
router.post('/refresh', refreshValidator, validate, ctrl.refresh.bind(ctrl));
router.post('/logout', refreshValidator, validate, ctrl.logout.bind(ctrl));
router.get('/me', authenticate, ctrl.me.bind(ctrl));
router.get('/login-history', authenticate, ctrl.loginHistory.bind(ctrl));
router.put('/change-password', authenticate, changePasswordValidator, validate, ctrl.changePassword.bind(ctrl));
router.put('/telegram-chat-id', authenticate, [body('telegramChatId').notEmpty()], validate, ctrl.updateTelegramChatId.bind(ctrl));
router.get('/telegram-chat-id', authenticate, ctrl.getTelegramChatId.bind(ctrl));

export default router;
