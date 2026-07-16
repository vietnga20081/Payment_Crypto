import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AuthRepository } from '../repositories/auth.repository';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../../utils/jwt';
import { AppError, UnauthorizedError } from '../../../utils/errors';
import { prisma } from '../../../prisma/client';
import { redis } from '../../../utils/redis';
import { sendEmail } from '../../../utils/mailer';
import { generateReferralCode } from '../../../utils/referral-code';
import { writeAuditLog } from '../../../utils/audit';
import { TwoFAService } from '../../twofa/services/twofa.service';

const repo = new AuthRepository();
const twoFA = new TwoFAService();

export class AuthService {
  async login(email: string, password: string, ipAddress: string, userAgent: string, twoFactorToken?: string) {
    const user = await repo.findByEmail(email);

    const logAttempt = async (success: boolean, reason?: string) =>
      prisma.loginAttempt.create({
        data: { userId: user?.id, email, ipAddress, success, reason },
      });

    // Brute-force protection: max 10 failed attempts in 15 minutes per email
    const recentFails = await prisma.loginAttempt.count({
      where: { email, success: false, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
    });
    if (recentFails >= 10) {
      await logAttempt(false, 'RATE_LIMITED');
      throw new AppError('Quá nhiều lần đăng nhập sai. Thử lại sau 15 phút', 429);
    }

    if (!user) {
      await logAttempt(false, 'USER_NOT_FOUND');
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }
    if (user.status !== 'ACTIVE') {
      await logAttempt(false, 'ACCOUNT_INACTIVE');
      throw new AppError('Tài khoản đã bị khóa', 403);
    }
    if (user.role === 'MERCHANT' && !user.emailVerifiedAt) {
      await logAttempt(false, 'EMAIL_NOT_VERIFIED');
      throw new AppError('Vui lòng xác thực email trước khi đăng nhập. Kiểm tra hộp thư của bạn.', 403);
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await logAttempt(false, 'WRONG_PASSWORD');
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    // 2FA check
    if (user.twoFactorEnabled) {
      if (!twoFactorToken) {
        return { requiresTwoFactor: true as const };
      }
      const validOtp = await twoFA.verify(user.id, twoFactorToken);
      if (!validOtp) {
        await logAttempt(false, 'INVALID_2FA');
        throw new AppError('Mã 2FA không đúng', 401);
      }
    }

    await logAttempt(true);
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ipAddress },
    });

    let merchantId: string | undefined;
    if (user.role === 'MERCHANT') {
      const merchant = await prisma.merchant.findUnique({ where: { userId: user.id } });
      merchantId = merchant?.id;
    }

    const payload = { userId: user.id, email: user.email, role: user.role, merchantId };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: { userId: user.id, token: refreshToken, expiresAt, ipAddress, userAgent },
    });

    return {
      requiresTwoFactor: false as const,
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  async refresh(token: string) {
    const record = await repo.findRefreshToken(token);
    if (!record) throw new UnauthorizedError('Invalid refresh token');

    const payload = verifyRefreshToken(token);
    await repo.deleteRefreshToken(token);

    let merchantId: string | undefined;
    if (record.user.role === 'MERCHANT') {
      const merchant = await prisma.merchant.findUnique({ where: { userId: record.user.id } });
      merchantId = merchant?.id;
    }

    const newPayload = { userId: payload.userId, email: payload.email, role: payload.role, merchantId };
    const accessToken = signAccessToken(newPayload);
    const refreshToken = signRefreshToken(newPayload);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await repo.saveRefreshToken(record.userId, refreshToken, expiresAt);

    return { accessToken, refreshToken };
  }

  async logout(token: string): Promise<void> {
    await repo.deleteRefreshToken(token);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await repo.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new AppError('Current password is incorrect', 400);

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    await repo.deleteUserRefreshTokens(userId);
  }

  async updateTelegramChatId(userId: string, telegramChatId: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { telegramChatId } });
  }

  async getTelegramChatId(userId: string): Promise<{ telegramChatId: string | null }> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { telegramChatId: true } });
    return { telegramChatId: user?.telegramChatId || null };
  }

  async getLoginHistory(userId: string, limit = 20) {
    return prisma.loginAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Đăng ký công khai cho Đại lý tự tạo tài khoản (khác với Admin tạo tay).
   * Tài khoản ở trạng thái ACTIVE nhưng KHÔNG login được cho tới khi xác thực
   * email (xem guard trong login()). Nếu có referralCode hợp lệ, liên kết
   * merchant mới với merchant đã giới thiệu.
   */
  async register(data: { email: string; password: string; merchantName: string; website?: string; referralCode?: string }, ipAddress?: string) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError('Email đã được sử dụng', 409);

    let referredByMerchantId: string | undefined;
    if (data.referralCode) {
      const referrer = await prisma.merchant.findUnique({ where: { referralCode: data.referralCode.toUpperCase() } });
      if (!referrer) throw new AppError('Mã giới thiệu không hợp lệ', 400);

      // Chống tự giới thiệu chính mình: nếu IP đăng ký trùng với IP lúc người
      // giới thiệu đăng ký, KHÔNG gắn quan hệ giới thiệu (nhưng vẫn cho đăng
      // ký bình thường — tránh chặn nhầm người dùng chung mạng/văn phòng).
      if (ipAddress && referrer.registrationIp && referrer.registrationIp === ipAddress) {
        await writeAuditLog({
          action: 'REFERRAL_SAME_IP_BLOCKED',
          resource: 'merchant',
          resourceId: referrer.id,
          ipAddress,
          newValue: { referralCode: data.referralCode, referrerMerchantId: referrer.id, email: data.email },
        });
      } else {
        referredByMerchantId = referrer.id;
      }
    }

    const feeRateSetting = await prisma.systemSetting.findUnique({ where: { key: 'default_merchant_fee_rate' } });
    const feeRate = Number(feeRateSetting?.value) || 0.01;

    const hashed = await bcrypt.hash(data.password, 10);
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    const referralCode = await generateReferralCode();

    const merchant = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: data.email, password: hashed, role: 'MERCHANT' },
      });
      return tx.merchant.create({
        data: {
          userId: user.id,
          name: data.merchantName,
          website: data.website,
          webhookSecret,
          feeRate,
          referralCode,
          referredByMerchantId,
          registrationIp: ipAddress,
        },
        include: { user: { select: { id: true, email: true } } },
      });
    });

    await this.sendVerificationEmail(merchant.user.id, merchant.user.email);

    return { email: merchant.user.email, merchantName: merchant.name };
  }

  private async sendVerificationEmail(userId: string, email: string) {
    const token = crypto.randomBytes(32).toString('hex');
    await redis.set(`email-verify:${token}`, userId, 'EX', 24 * 60 * 60); // 24h

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    await sendEmail(
      email,
      '[Crypto Gateway] Xác thực tài khoản của bạn',
      `<p>Chào bạn,</p>
       <p>Bấm vào link dưới đây để xác thực tài khoản và bắt đầu sử dụng:</p>
       <p><a href="${verifyUrl}">${verifyUrl}</a></p>
       <p>Link có hiệu lực trong 24 giờ.</p>`
    );
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await redis.get(`email-verify:${token}`);
    if (!userId) throw new AppError('Link xác thực không hợp lệ hoặc đã hết hạn', 400);

    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    await redis.del(`email-verify:${token}`);
  }

  async resendVerification(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    // Không tiết lộ email có tồn tại hay không — luôn trả về thành công dạng chung chung
    if (!user || user.emailVerifiedAt || user.role !== 'MERCHANT') return;

    const cooldownKey = `resend-verify-cooldown:${user.id}`;
    const inCooldown = await redis.get(cooldownKey);
    if (inCooldown) throw new AppError('Vui lòng đợi ít phút trước khi gửi lại', 429);
    await redis.set(cooldownKey, '1', 'EX', 60);

    await this.sendVerificationEmail(user.id, user.email);
  }
}
