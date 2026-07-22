import { prisma } from '../../../prisma/client';
import { TransactionStatus, UserStatus, WithdrawalStatus } from '@prisma/client';

export class ReportsService {
  async getRevenue(startDate: string, endDate: string, merchantId?: string) {
    const where = {
      status: TransactionStatus.COMPLETED,
      createdAt: { gte: new Date(startDate), lte: new Date(endDate) },
      ...(merchantId && { merchantId }),
    };
    const transactions = await prisma.transaction.findMany({
      where,
      select: { amount: true, fee: true, netAmount: true, createdAt: true, merchantId: true },
    });
    const grouped: Record<string, { date: string; volume: number; fee: number; count: number }> = {};
    for (const tx of transactions) {
      const date = tx.createdAt.toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = { date, volume: 0, fee: 0, count: 0 };
      grouped[date].volume += Number(tx.amount);
      grouped[date].fee += Number(tx.fee);
      grouped[date].count++;
    }
    const daily = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
    return {
      daily,
      totalVolume: transactions.reduce((s, t) => s + Number(t.amount), 0),
      totalFee: transactions.reduce((s, t) => s + Number(t.fee), 0),
      totalTransactions: transactions.length,
    };
  }

  async getDashboardStats() {
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [
      totalMerchants, activeMerchants,
      totalTx, todayTx, yesterdayTx, completedTx, pendingTx, confirmingTx,
      monthVolume, lastMonthVolume,
      pendingWithdrawals, processingWithdrawals,
      todayVolume, yesterdayVolume,
    ] = await Promise.all([
      prisma.merchant.count({ where: { deletedAt: null } }),
      prisma.merchant.count({ where: { status: UserStatus.ACTIVE, deletedAt: null } }),
      prisma.transaction.count(),
      prisma.transaction.count({ where: { createdAt: { gte: today } } }),
      prisma.transaction.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
      prisma.transaction.count({ where: { status: TransactionStatus.COMPLETED } }),
      prisma.transaction.count({ where: { status: TransactionStatus.PENDING } }),
      prisma.transaction.count({ where: { status: TransactionStatus.CONFIRMING } }),
      prisma.transaction.aggregate({
        where: { status: TransactionStatus.COMPLETED, createdAt: { gte: thisMonth } },
        _sum: { amount: true, fee: true },
      }),
      prisma.transaction.aggregate({
        where: { status: TransactionStatus.COMPLETED, createdAt: { gte: lastMonth, lte: lastMonthEnd } },
        _sum: { amount: true },
      }),
      prisma.withdrawal.count({ where: { status: WithdrawalStatus.PENDING } }),
      prisma.withdrawal.count({ where: { status: WithdrawalStatus.PROCESSING } }),
      prisma.transaction.aggregate({
        where: { status: TransactionStatus.COMPLETED, confirmedAt: { gte: today } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { status: TransactionStatus.COMPLETED, confirmedAt: { gte: yesterday, lt: today } },
        _sum: { amount: true },
      }),
    ]);

    // Hourly chart for today (last 24h)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTxs = await prisma.transaction.findMany({
      where: { createdAt: { gte: last24h } },
      select: { createdAt: true, status: true, amount: true },
    });
    const hourlyMap: Record<number, { hour: number; count: number; completed: number; volume: number }> = {};
    for (let h = 0; h < 24; h++) hourlyMap[h] = { hour: h, count: 0, completed: 0, volume: 0 };
    for (const tx of recentTxs) {
      const h = new Date(tx.createdAt).getHours();
      hourlyMap[h].count++;
      if (tx.status === TransactionStatus.COMPLETED) {
        hourlyMap[h].completed++;
        hourlyMap[h].volume += Number(tx.amount);
      }
    }
    const hourlyChart = Object.values(hourlyMap).sort((a, b) => a.hour - b.hour);

    // Top merchants this month
    const topMerchants = await prisma.transaction.groupBy({
      by: ['merchantId'],
      where: { status: TransactionStatus.COMPLETED, createdAt: { gte: thisMonth } },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    });
    const topMerchantIds = topMerchants.map((m) => m.merchantId);
    const merchantNames = await prisma.merchant.findMany({
      where: { id: { in: topMerchantIds } },
      select: { id: true, name: true },
    });
    const nameMap = Object.fromEntries(merchantNames.map((m) => [m.id, m.name]));

    // Status breakdown (today)
    const statusBreakdown = await prisma.transaction.groupBy({
      by: ['status'],
      where: { createdAt: { gte: today } },
      _count: { id: true },
    });

    const todayVol = Number(todayVolume._sum.amount || 0);
    const yestVol = Number(yesterdayVolume._sum.amount || 0);
    const monthVol = Number(monthVolume._sum.amount || 0);
    const lastMonthVol = Number(lastMonthVolume._sum.amount || 0);

    return {
      merchants: { total: totalMerchants, active: activeMerchants },
      transactions: {
        total: totalTx,
        today: todayTx,
        yesterday: yesterdayTx,
        todayChange: yesterdayTx > 0 ? ((todayTx - yesterdayTx) / yesterdayTx) * 100 : 0,
        completed: completedTx,
        pending: pendingTx,
        confirming: confirmingTx,
      },
      revenue: {
        monthVolume: monthVol,
        monthFee: Number(monthVolume._sum.fee || 0),
        lastMonthVolume: lastMonthVol,
        monthChange: lastMonthVol > 0 ? ((monthVol - lastMonthVol) / lastMonthVol) * 100 : 0,
        todayVolume: todayVol,
        yesterdayVolume: yestVol,
        todayVolumeChange: yestVol > 0 ? ((todayVol - yestVol) / yestVol) * 100 : 0,
      },
      withdrawals: { pending: pendingWithdrawals, processing: processingWithdrawals },
      hourlyChart,
      topMerchants: topMerchants.map((m) => ({
        merchantId: m.merchantId,
        name: nameMap[m.merchantId] || 'Unknown',
        volume: Number(m._sum.amount || 0),
        count: m._count.id,
      })),
      statusBreakdown: statusBreakdown.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
    };
  }

  // 30-day trend for sparklines
  async getTrend(days = 30, merchantId?: string) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const txs = await prisma.transaction.findMany({
      where: {
        status: TransactionStatus.COMPLETED,
        confirmedAt: { gte: since },
        ...(merchantId && { merchantId }),
      },
      select: { confirmedAt: true, amount: true, fee: true },
    });
    const map: Record<string, { date: string; volume: number; fee: number; count: number }> = {};
    for (const tx of txs) {
      const date = tx.confirmedAt!.toISOString().split('T')[0];
      if (!map[date]) map[date] = { date, volume: 0, fee: 0, count: 0 };
      map[date].volume += Number(tx.amount);
      map[date].fee += Number(tx.fee);
      map[date].count++;
    }
    // Fill missing days with 0
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      result.push(map[dateStr] || { date: dateStr, volume: 0, fee: 0, count: 0 });
    }
    return result;
  }

  // Merchant self dashboard
  async getMerchantDashboard(merchantId: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalTx, todayTx, completedTx, pendingTx,
      monthVolume, merchant,
    ] = await Promise.all([
      prisma.transaction.count({ where: { merchantId } }),
      prisma.transaction.count({ where: { merchantId, createdAt: { gte: today } } }),
      prisma.transaction.count({ where: { merchantId, status: TransactionStatus.COMPLETED } }),
      prisma.transaction.count({ where: { merchantId, status: TransactionStatus.PENDING } }),
      prisma.transaction.aggregate({
        where: { merchantId, status: TransactionStatus.COMPLETED, createdAt: { gte: thisMonth } },
        _sum: { amount: true, netAmount: true, fee: true },
      }),
      prisma.merchant.findUnique({
        where: { id: merchantId },
        select: { balance: true, frozenBalance: true, feeRate: true },
      }),
    ]);

    return {
      transactions: { total: totalTx, today: todayTx, completed: completedTx, pending: pendingTx },
      revenue: {
        monthVolume: Number(monthVolume._sum.amount || 0),
        monthNetAmount: Number(monthVolume._sum.netAmount || 0),
        monthFee: Number(monthVolume._sum.fee || 0),
      },
      balance: Number(merchant?.balance || 0),
      frozenBalance: Number(merchant?.frozenBalance || 0),
      feeRate: Number(merchant?.feeRate || 0),
    };
  }
}
