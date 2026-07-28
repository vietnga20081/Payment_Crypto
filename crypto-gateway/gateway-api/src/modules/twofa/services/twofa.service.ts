import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { prisma } from '../../../prisma/client';
import { AppError, NotFoundError } from '../../../utils/errors';

export class TwoFAService {
  async generateSecret(userId: string, email: string) {
    const secret = speakeasy.generateSecret({
      name: `CryptoGW (${email})`,
      issuer: 'CryptoGW',
      length: 20,
    });

    // Store unconfirmed secret temporarily; confirmed only after verify()
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32, twoFactorEnabled: false },
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
    return { secret: secret.base32, qrCodeUrl };
  }

  async verifyAndEnable(userId: string, token: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) throw new AppError('2FA chưa được khởi tạo', 400);

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1,
    });
    if (!valid) throw new AppError('Mã OTP không đúng', 400);

    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(5).toString('hex').toUpperCase()
    );
    const hashedCodes = backupCodes.map((c) =>
      crypto.createHash('sha256').update(c).digest('hex')
    );

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, backupCodes: JSON.stringify(hashedCodes) },
    });

    return { backupCodes };
  }

  async verify(userId: string, token: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) return true; // 2FA not enabled = pass

    // Try TOTP first
    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1,
    });
    if (valid) return true;

    // Try backup code
    if (user.backupCodes) {
      const hashed = crypto.createHash('sha256').update(token.toUpperCase()).digest('hex');
      const codes: string[] = JSON.parse(user.backupCodes);
      const idx = codes.indexOf(hashed);
      if (idx >= 0) {
        codes.splice(idx, 1);
        await prisma.user.update({
          where: { id: userId },
          data: { backupCodes: JSON.stringify(codes) },
        });
        return true;
      }
    }
    return false;
  }

  async disable(userId: string, password: string, bcryptCompare: (p: string, h: string) => Promise<boolean>) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    const valid = await bcryptCompare(password, user.password);
    if (!valid) throw new AppError('Mật khẩu không đúng', 400);

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, backupCodes: null },
    });
  }

  async status(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorEnabled: true } });
    return { enabled: user?.twoFactorEnabled || false };
  }
}
