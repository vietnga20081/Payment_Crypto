import { prisma } from '../../../prisma/client';
import { logger } from '../../../utils/logger';
import { AppError } from '../../../utils/errors';
import { sendAlert } from '../../../utils/alert';
import { sendUsdtTrc20 } from '../../../services/chain/tron-signer';
import { sendUsdtBep20 } from '../../../services/chain/bsc-signer';
import { SweepStatus, WalletType, NetworkType } from '@prisma/client';

export class SweepService {
  async sweepWallet(walletId: string, minSweepAmount = 50): Promise<{ swept: boolean; txHash?: string; amount?: number }> {
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet || wallet.type !== 'HOT') throw new AppError('Chỉ sweep được ví HOT', 400);

    // Ví COLD đích PHẢI cùng mạng với ví nguồn — sweep USDT-TRC20 sang ví BEP20
    // (hoặc ngược lại) là vô nghĩa vì khác định dạng địa chỉ hoàn toàn.
    const coldWallet = await prisma.wallet.findFirst({
      where: { type: WalletType.COLD, network: wallet.network, isActive: true },
    });
    if (!coldWallet) throw new AppError(`Chưa cấu hình ví COLD đích cho mạng ${wallet.network}`, 400);

    if (Number(wallet.balance) < minSweepAmount) {
      return { swept: false };
    }

    const log = await prisma.sweepLog.create({
      data: {
        walletId: wallet.id,
        toAddress: coldWallet.address,
        amount: wallet.balance,
        status: SweepStatus.PROCESSING,
      },
    });

    try {
      const txHash = wallet.network === NetworkType.BEP20
        ? await sendUsdtBep20(wallet.privateKey, coldWallet.address, Number(wallet.balance))
        : await sendUsdtTrc20(wallet.privateKey, coldWallet.address, Number(wallet.balance));

      await prisma.sweepLog.update({
        where: { id: log.id },
        data: { status: SweepStatus.COMPLETED, txHash, completedAt: new Date() },
      });
      await prisma.wallet.update({ where: { id: wallet.id }, data: { balance: 0 } });
      await prisma.wallet.update({
        where: { id: coldWallet.id },
        data: { balance: { increment: wallet.balance } },
      });

      logger.info('Sweep completed', { walletId, network: wallet.network, amount: wallet.balance, txHash });
      return { swept: true, txHash, amount: Number(wallet.balance) };
    } catch (err) {
      await prisma.sweepLog.update({
        where: { id: log.id },
        data: { status: SweepStatus.FAILED, errorMessage: (err as Error).message },
      });
      logger.error('Sweep failed', { walletId, network: wallet.network, error: (err as Error).message });
      await sendAlert(`sweep-failed-${walletId}`, `Sweep ví ${wallet.address} (${wallet.network}) thất bại: ${(err as Error).message}`, 'critical');
      throw new AppError(`Sweep thất bại: ${(err as Error).message}`, 500);
    }
  }

  async sweepAllEligible(threshold = 500) {
    const wallets = await prisma.wallet.findMany({
      where: { type: WalletType.HOT, isActive: true, balance: { gte: threshold } },
    });

    const results = [];
    for (const wallet of wallets) {
      try {
        const result = await this.sweepWallet(wallet.id, threshold);
        results.push({ walletId: wallet.id, network: wallet.network, ...result });
      } catch (err) {
        results.push({ walletId: wallet.id, network: wallet.network, swept: false, error: (err as Error).message });
      }
    }
    return results;
  }

  async getSweepHistory(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.sweepLog.findMany({
        skip, take: limit,
        include: { wallet: { select: { address: true, label: true, network: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sweepLog.count(),
    ]);
    return { data, total };
  }
}
