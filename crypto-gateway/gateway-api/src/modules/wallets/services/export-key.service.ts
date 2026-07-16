import crypto from 'crypto';
import { prisma } from '../../../prisma/client';
import { redis } from '../../../utils/redis';
import { AppError, NotFoundError } from '../../../utils/errors';
import { sendEmail, isSmtpConfigured } from '../../../utils/mailer';
import { sendTelegramDM, isTelegramBotConfigured } from '../../../utils/telegram-otp';
import { writeAuditLog } from '../../../utils/audit';
import { decryptSecret } from '../../../utils/crypto-vault';

const OTP_TTL_SECONDS = 5 * 60; // 5 phút
const MAX_ATTEMPTS = 5;
const REQUEST_COOLDOWN_SECONDS = 60; // chống spam gửi OTP liên tục

interface Challenge {
  userId: string;
  walletId: string;
  telegramCode: string;
  emailCode: string;
  attempts: number;
}

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export class ExportKeyService {
  /**
   * Bước 1: Khởi tạo yêu cầu export — gửi 2 mã OTP riêng biệt qua Telegram và
   * Email. Cả 2 kênh đều BẮT BUỘC phải được cấu hình và admin phải có
   * telegramChatId + email hợp lệ, nếu không sẽ chặn ngay từ đầu (không cho
   * export bằng 1 kênh duy nhất).
   */
  async requestExport(userId: string, walletId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundError('Wallet not found');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    if (!user.telegramChatId) {
      throw new AppError(
        'Bạn chưa cấu hình Telegram Chat ID cá nhân. Vào Hồ sơ → Bảo mật để thiết lập trước khi export private key.',
        400
      );
    }

    const [botConfigured, smtpConfigured] = await Promise.all([
      isTelegramBotConfigured(),
      isSmtpConfigured(),
    ]);
    if (!botConfigured || !smtpConfigured) {
      throw new AppError(
        'Hệ thống chưa cấu hình đủ Telegram Bot + SMTP trong Admin → Cài đặt → Tích hợp. Cả 2 kênh đều bắt buộc để export private key.',
        400
      );
    }

    const cooldownKey = `export-key-cooldown:${userId}:${walletId}`;
    const inCooldown = await redis.get(cooldownKey);
    if (inCooldown) {
      throw new AppError('Vui lòng đợi ít phút trước khi yêu cầu lại OTP.', 429);
    }

    const requestId = crypto.randomUUID();
    const telegramCode = generateOtp();
    const emailCode = generateOtp();

    const challenge: Challenge = { userId, walletId, telegramCode, emailCode, attempts: 0 };
    await redis.set(`export-key:${requestId}`, JSON.stringify(challenge), 'EX', OTP_TTL_SECONDS);
    await redis.set(cooldownKey, '1', 'EX', REQUEST_COOLDOWN_SECONDS);

    const shortAddr = `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}`;

    const [telegramOk, emailOk] = await Promise.all([
      sendTelegramDM(
        user.telegramChatId,
        `🔐 Mã xác thực export private key\n\nVí: <b>${shortAddr}</b> (${wallet.network})\nMã của bạn: <b>${telegramCode}</b>\n\nMã có hiệu lực trong 5 phút. Nếu không phải bạn yêu cầu, hãy bỏ qua và kiểm tra bảo mật tài khoản.`
      ),
      sendEmail(
        user.email,
        `[Crypto Gateway] Mã xác thực export private key: ${emailCode}`,
        `<p>Bạn (hoặc ai đó dùng tài khoản của bạn) vừa yêu cầu export private key của ví:</p>
         <p><b>${shortAddr}</b> (${wallet.network})</p>
         <p>Mã xác thực của bạn: <b style="font-size:20px">${emailCode}</b></p>
         <p>Mã có hiệu lực trong 5 phút. Nếu không phải bạn yêu cầu, vui lòng kiểm tra lại bảo mật tài khoản ngay.</p>`
      ),
    ]);

    if (!telegramOk || !emailOk) {
      await redis.del(`export-key:${requestId}`);
      throw new AppError(
        `Gửi OTP thất bại (${!telegramOk ? 'Telegram' : ''}${!telegramOk && !emailOk ? ' và ' : ''}${!emailOk ? 'Email' : ''}). Kiểm tra lại cấu hình hoặc Chat ID/Email.`,
        500
      );
    }

    return { requestId, expiresInSeconds: OTP_TTL_SECONDS };
  }

  /**
   * Bước 2: Xác thực CẢ HAI mã. Chỉ khi cả Telegram code và Email code đều
   * đúng mới trả về private key — sai bất kỳ mã nào cũng coi là thất bại
   * chung (không tiết lộ mã nào sai, tránh dò từng kênh).
   */
  async verifyAndExport(
    userId: string,
    requestId: string,
    telegramCode: string,
    emailCode: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const key = `export-key:${requestId}`;
    const raw = await redis.get(key);
    if (!raw) throw new AppError('Yêu cầu đã hết hạn hoặc không tồn tại. Vui lòng yêu cầu OTP mới.', 400);

    const challenge: Challenge = JSON.parse(raw);
    if (challenge.userId !== userId) throw new AppError('Yêu cầu không hợp lệ', 403);

    if (challenge.attempts >= MAX_ATTEMPTS) {
      await redis.del(key);
      throw new AppError('Nhập sai quá nhiều lần. Vui lòng yêu cầu OTP mới.', 429);
    }

    const isValid = challenge.telegramCode === telegramCode.trim() && challenge.emailCode === emailCode.trim();

    if (!isValid) {
      challenge.attempts += 1;
      const ttl = await redis.ttl(key);
      await redis.set(key, JSON.stringify(challenge), 'EX', ttl > 0 ? ttl : OTP_TTL_SECONDS);

      await writeAuditLog({
        userId,
        action: 'WALLET_PRIVATE_KEY_EXPORT_FAILED',
        resource: 'wallet',
        resourceId: challenge.walletId,
        ipAddress,
        userAgent,
        newValue: { reason: 'invalid_otp', attempts: challenge.attempts },
      });

      throw new AppError(`Mã xác thực không đúng (còn ${MAX_ATTEMPTS - challenge.attempts} lần thử).`, 400);
    }

    // Thành công — xoá challenge ngay (one-time use), không cho verify lại lần 2
    await redis.del(key);

    const wallet = await prisma.wallet.findUnique({ where: { id: challenge.walletId } });
    if (!wallet) throw new NotFoundError('Wallet not found');

    await writeAuditLog({
      userId,
      action: 'WALLET_PRIVATE_KEY_EXPORT_SUCCESS',
      resource: 'wallet',
      resourceId: wallet.id,
      ipAddress,
      userAgent,
      newValue: { address: wallet.address, network: wallet.network },
    });

    return {
      address: wallet.address,
      network: wallet.network,
      privateKey: decryptSecret(wallet.privateKey),
    };
  }
}
