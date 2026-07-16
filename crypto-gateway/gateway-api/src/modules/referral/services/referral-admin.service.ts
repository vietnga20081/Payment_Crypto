import { prisma } from '../../../prisma/client';

const SETTING_KEYS = ['referral_enabled', 'referral_commission_rate', 'referral_duration_days', 'referral_daily_cap'];

export class ReferralAdminService {
  async getSettings() {
    const rows = await prisma.systemSetting.findMany({ where: { key: { in: SETTING_KEYS } } });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      enabled: map.referral_enabled === 'true',
      commissionRate: Number(map.referral_commission_rate) || 0,
      durationDays: Number(map.referral_duration_days) || 0,
      dailyCap: Number(map.referral_daily_cap) || 0,
    };
  }

  async updateSettings(data: { enabled: boolean; commissionRate: number; durationDays: number; dailyCap: number }) {
    await Promise.all([
      prisma.systemSetting.update({ where: { key: 'referral_enabled' }, data: { value: data.enabled ? 'true' : 'false' } }),
      prisma.systemSetting.update({ where: { key: 'referral_commission_rate' }, data: { value: String(data.commissionRate) } }),
      prisma.systemSetting.update({ where: { key: 'referral_duration_days' }, data: { value: String(data.durationDays) } }),
      prisma.systemSetting.update({ where: { key: 'referral_daily_cap' }, data: { value: String(data.dailyCap) } }),
    ]);
    return this.getSettings();
  }

  async getStats() {
    const [totalPaid, totalReferralRelations, totalCommissionRows, suspiciousAttempts] = await Promise.all([
      prisma.referralCommission.aggregate({ _sum: { amount: true } }),
      prisma.merchant.count({ where: { referredByMerchantId: { not: null } } }),
      prisma.referralCommission.count(),
      prisma.auditLog.findMany({
        where: { action: 'REFERRAL_SAME_IP_BLOCKED' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    // Leaderboard: top merchant theo tổng hoa hồng đã nhận
    const grouped = await prisma.referralCommission.groupBy({
      by: ['referrerMerchantId'],
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 20,
    });

    const merchantIds = grouped.map((g) => g.referrerMerchantId);
    const merchants = await prisma.merchant.findMany({
      where: { id: { in: merchantIds } },
      select: { id: true, name: true, referralCode: true, user: { select: { email: true } } },
    });
    const merchantMap = Object.fromEntries(merchants.map((m) => [m.id, m]));

    const leaderboard = grouped.map((g) => ({
      merchantId: g.referrerMerchantId,
      merchantName: merchantMap[g.referrerMerchantId]?.name || '—',
      merchantEmail: merchantMap[g.referrerMerchantId]?.user?.email || '—',
      referralCode: merchantMap[g.referrerMerchantId]?.referralCode || '—',
      totalCommission: g._sum.amount || 0,
      commissionCount: g._count.id,
    }));

    return {
      totalCommissionPaid: totalPaid._sum.amount || 0,
      totalReferralRelations,
      totalCommissionRows,
      leaderboard,
      suspiciousAttempts: suspiciousAttempts.map((a) => ({
        id: a.id,
        ipAddress: a.ipAddress,
        createdAt: a.createdAt,
        detail: a.newValue,
      })),
    };
  }
}
