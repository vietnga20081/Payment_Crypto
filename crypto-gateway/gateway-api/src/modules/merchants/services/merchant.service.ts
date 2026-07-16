import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserStatus, EnvironmentMode, UserRole } from '@prisma/client';
import { MerchantRepository } from '../repositories/merchant.repository';
import { prisma } from '../../../prisma/client';
import { AppError, ConflictError, NotFoundError } from '../../../utils/errors';
import { getPagination, getPaginationMeta } from '../../../utils/response';
import { generateReferralCode } from '../../../utils/referral-code';

const repo = new MerchantRepository();

export class MerchantService {
  async list(page: number, limit: number, search?: string, status?: string) {
    const { skip, take } = getPagination(page, limit);
    const { data, total } = await repo.findAll({ skip, take, search, status });
    return { data, meta: getPaginationMeta(total, page, limit) };
  }

  async getById(id: string) {
    const merchant = await repo.findById(id);
    if (!merchant) throw new NotFoundError('Merchant not found');
    return merchant;
  }

  async getProfile(userId: string) {
    const merchant = await repo.findByUserId(userId);
    if (!merchant) throw new NotFoundError('Merchant profile not found');
    return merchant;
  }

  async create(data: {
    email: string;
    password: string;
    name: string;
    website?: string;
    callbackUrl?: string;
    feeRate?: number;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictError('Email already exists');

    const hashed = await bcrypt.hash(data.password, 10);
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    const referralCode = await generateReferralCode();

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: data.email, password: hashed, role: UserRole.MERCHANT, emailVerifiedAt: new Date() },
      });
      return tx.merchant.create({
        data: {
          userId: user.id,
          name: data.name,
          website: data.website,
          callbackUrl: data.callbackUrl,
          webhookSecret,
          feeRate: data.feeRate ?? 0.01,
          referralCode,
        },
        include: { user: { select: { email: true } } },
      });
    });
  }

  async update(id: string, data: { name?: string; website?: string; callbackUrl?: string; feeRate?: number; status?: UserStatus }) {
    await this.getById(id);
    return repo.update(id, data);
  }

  async verifyEmailManually(id: string) {
    const merchant = await this.getById(id);
    await prisma.user.update({ where: { id: merchant.userId }, data: { emailVerifiedAt: new Date() } });
  }

  /**
   * Merchant tự chuyển toàn bộ hoa hồng giới thiệu (referralBalance) vào số dư
   * chính (balance) — lúc đó mới rút được, vì API rút tiền chỉ trừ từ `balance`.
   * Tách riêng bước này để merchant luôn phân biệt rõ tiền nào từ giao dịch,
   * tiền nào từ giới thiệu, tự quyết định lúc nào gộp vào để rút.
   */
  async transferReferralBalance(merchantId: string) {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new NotFoundError('Merchant not found');

    const amount = merchant.referralBalance;
    if (Number(amount) <= 0) {
      throw new AppError('Không có hoa hồng nào để chuyển', 400);
    }

    return prisma.$transaction(async (tx) => {
      await tx.merchant.update({
        where: { id: merchantId },
        data: {
          referralBalance: { decrement: amount },
          balance: { increment: amount },
        },
      });
      return { transferredAmount: amount };
    });
  }

  async getReferrals(merchantId: string) {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new NotFoundError('Merchant not found');

    const [referrals, commissions, totalEarned] = await Promise.all([
      prisma.merchant.findMany({
        where: { referredByMerchantId: merchantId },
        select: {
          id: true, name: true, status: true, createdAt: true,
          user: { select: { email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.referralCommission.findMany({
        where: { referrerMerchantId: merchantId },
        include: { referred: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.referralCommission.aggregate({
        where: { referrerMerchantId: merchantId },
        _sum: { amount: true },
      }),
    ]);

    return {
      referralCode: merchant.referralCode,
      referrals,
      totalCommissionEarned: totalEarned._sum.amount || 0,
      commissionHistory: commissions,
    };
  }

  async updateProfile(userId: string, data: { name?: string; website?: string; callbackUrl?: string }) {
    const merchant = await repo.findByUserId(userId);
    if (!merchant) throw new NotFoundError('Merchant not found');
    return repo.update(merchant.id, data);
  }

  async resetWebhookSecret(id: string) {
    await this.getById(id);
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    await repo.update(id, { webhookSecret });
    return { webhookSecret };
  }

  async resetOwnWebhookSecret(userId: string) {
    const merchant = await repo.findByUserId(userId);
    if (!merchant) throw new NotFoundError('Merchant not found');
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    await repo.update(merchant.id, { webhookSecret });
    return { webhookSecret };
  }

  async delete(id: string) {
    await this.getById(id);
    return repo.softDelete(id);
  }

  async getApiKeys(merchantId: string) {
    return prisma.apiKey.findMany({
      where: { merchantId, deletedAt: null },
      select: { id: true, name: true, key: true, environment: true, isActive: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createApiKey(merchantId: string, name: string, environment: EnvironmentMode = EnvironmentMode.LIVE) {
    const prefix = environment === EnvironmentMode.SANDBOX ? 'sk_test' : 'mk_live';
    const key = `${prefix}_${crypto.randomBytes(16).toString('hex')}`;
    const secret = crypto.randomBytes(32).toString('hex');
    const hashedSecret = crypto.createHash('sha256').update(secret).digest('hex');

    await prisma.apiKey.create({
      data: { merchantId, name, key, secret: hashedSecret, environment },
    });

    return { key, secret, name, environment };
  }

  async revokeApiKey(merchantId: string, keyId: string) {
    const apiKey = await prisma.apiKey.findFirst({ where: { id: keyId, merchantId, deletedAt: null } });
    if (!apiKey) throw new NotFoundError('API key not found');
    await prisma.apiKey.update({ where: { id: keyId }, data: { isActive: false, deletedAt: new Date() } });
  }
}
