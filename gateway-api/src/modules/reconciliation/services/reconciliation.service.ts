import { prisma } from '../../../prisma/client';
import { NotFoundError, AppError } from '../../../utils/errors';
import { getPagination, getPaginationMeta } from '../../../utils/response';
import { TransactionStatus } from '@prisma/client';

export class ReconciliationService {
  async list(merchantId: string | undefined, page: number, limit: number) {
    const { skip, take } = getPagination(page, limit);
    const where = merchantId ? { merchantId } : {};
    const [data, total] = await Promise.all([
      prisma.reconciliation.findMany({
        where, skip, take,
        include: { merchant: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.reconciliation.count({ where }),
    ]);
    return { data, meta: getPaginationMeta(total, page, limit) };
  }

  /**
   * Generates a reconciliation batch for a merchant over a date range.
   * Compares the merchant's reported orderIds (if provided) vs actual completed transactions.
   */
  async generate(merchantId: string, periodStart: Date, periodEnd: Date, expectedOrderIds?: string[]) {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new NotFoundError('Merchant not found');

    const transactions = await prisma.transaction.findMany({
      where: {
        merchantId,
        status: TransactionStatus.COMPLETED,
        confirmedAt: { gte: periodStart, lte: periodEnd },
      },
    });

    const actualOrderIds = new Set(transactions.map((t) => t.orderId));
    const expectedVolume = transactions.reduce((s, t) => s + Number(t.amount), 0);

    let discrepancyCount = 0;
    if (expectedOrderIds?.length) {
      const expectedSet = new Set(expectedOrderIds);
      // Orders merchant expected but system doesn't show as completed
      discrepancyCount += expectedOrderIds.filter((id) => !actualOrderIds.has(id)).length;
      // Orders system completed but merchant didn't expect
      discrepancyCount += transactions.filter((t) => !expectedSet.has(t.orderId)).length;
    }

    const reconciliation = await prisma.reconciliation.create({
      data: {
        merchantId,
        periodStart,
        periodEnd,
        expectedCount: expectedOrderIds?.length || transactions.length,
        expectedVolume,
        matchedCount: transactions.length,
        matchedVolume: expectedVolume,
        discrepancyCount,
        status: discrepancyCount > 0 ? 'DISCREPANCY' : 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Link transactions to this reconciliation batch
    await prisma.transaction.updateMany({
      where: { id: { in: transactions.map((t) => t.id) } },
      data: { reconciliationId: reconciliation.id, reconciledAt: new Date() },
    });

    return reconciliation;
  }

  async getDetail(id: string) {
    const recon = await prisma.reconciliation.findUnique({
      where: { id },
      include: {
        merchant: { select: { name: true } },
        transactions: { orderBy: { confirmedAt: 'desc' } },
      },
    });
    if (!recon) throw new NotFoundError('Reconciliation not found');
    return recon;
  }

  /** Merchant-facing: simple summary for self-checking against their own records */
  async getMerchantSummary(merchantId: string, startDate: Date, endDate: Date) {
    const transactions = await prisma.transaction.findMany({
      where: { merchantId, status: TransactionStatus.COMPLETED, confirmedAt: { gte: startDate, lte: endDate } },
      select: { orderId: true, amount: true, fee: true, netAmount: true, txHash: true, confirmedAt: true },
      orderBy: { confirmedAt: 'desc' },
    });
    const totalVolume = transactions.reduce((s, t) => s + Number(t.amount), 0);
    const totalFee = transactions.reduce((s, t) => s + Number(t.fee), 0);
    return { transactions, totalVolume, totalFee, count: transactions.length };
  }
}
