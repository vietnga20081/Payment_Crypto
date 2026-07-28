import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { sendSuccess } from '../../../utils/response';
import { getRequestIp } from '../../../middlewares/ipwhitelist.middleware';

const service = new AuthService();

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = getRequestIp(req);
      const userAgent = req.headers['user-agent'] || '';
      const result = await service.login(req.body.email, req.body.password, ip, userAgent, req.body.twoFactorToken);

      if (result.requiresTwoFactor) {
        sendSuccess(res, { requiresTwoFactor: true }, 'Nhập mã 2FA để tiếp tục');
        return;
      }
      sendSuccess(res, result, 'Login successful');
    } catch (err) { next(err); }
  }

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = getRequestIp(req);
      const result = await service.register({
        email: req.body.email,
        password: req.body.password,
        merchantName: req.body.merchantName,
        website: req.body.website,
        referralCode: req.body.referralCode,
      }, ip);
      sendSuccess(res, result, 'Đăng ký thành công — kiểm tra email để xác thực tài khoản', 201);
    } catch (err) { next(err); }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.verifyEmail(req.body.token);
      sendSuccess(res, null, 'Xác thực email thành công — bạn có thể đăng nhập ngay');
    } catch (err) { next(err); }
  }

  async resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.resendVerification(req.body.email);
      sendSuccess(res, null, 'Nếu email tồn tại và chưa xác thực, chúng tôi đã gửi lại link xác thực');
    } catch (err) { next(err); }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await service.refresh(req.body.refreshToken);
      sendSuccess(res, result, 'Token refreshed');
    } catch (err) { next(err); }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.logout(req.body.refreshToken);
      sendSuccess(res, null, 'Logged out successfully');
    } catch (err) { next(err); }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, req.user, 'Profile fetched');
    } catch (err) { next(err); }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.changePassword(req.user!.userId, req.body.currentPassword, req.body.newPassword);
      sendSuccess(res, null, 'Password changed successfully');
    } catch (err) { next(err); }
  }

  async updateTelegramChatId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.updateTelegramChatId(req.user!.userId, req.body.telegramChatId);
      sendSuccess(res, null, 'Đã cập nhật Telegram Chat ID');
    } catch (err) { next(err); }
  }

  async getTelegramChatId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await service.getTelegramChatId(req.user!.userId));
    } catch (err) { next(err); }
  }

  async loginHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await service.getLoginHistory(req.user!.userId));
    } catch (err) { next(err); }
  }

  async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await service.getSessions(req.user!.userId));
    } catch (err) { next(err); }
  }

  async revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.revokeSession(req.user!.userId, req.params.sessionId);
      sendSuccess(res, null, 'Đã thu hồi phiên đăng nhập');
    } catch (err) { next(err); }
  }

  async revokeAllSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.revokeAllSessions(req.user!.userId);
      sendSuccess(res, null, 'Đã thu hồi toàn bộ phiên đăng nhập — cần đăng nhập lại trên mọi thiết bị');
    } catch (err) { next(err); }
  }
}
