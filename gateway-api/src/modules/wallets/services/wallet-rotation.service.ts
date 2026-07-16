import { prisma } from '../../../prisma/client';
import { AppError } from '../../../utils/errors';
import { WalletType, NetworkType } from '@prisma/client';

export class WalletRotationService {
  /**
   * Picks the next available wallet for a payment, using round-robin
   * based on lastAssignedAt to spread load across the hot wallet pool.
   * If the merchant has a pinned MerchantWallet on the matching network,
   * that takes priority; otherwise falls back to the shared rotation pool.
   */
  async getNextWallet(merchantId: string, network: NetworkType = NetworkType.TRC20) {
    const pinned = await prisma.merchantWallet.findFirst({
      where: { merchantId, isActive: true, wallet: { network } },
      include: { wallet: true },
    });
    if (pinned && pinned.wallet.isActive) {
      return pinned.wallet;
    }

    const wallet = await prisma.wallet.findFirst({
      where: { type: WalletType.HOT, network, isActive: true, inRotation: true },
      orderBy: [{ lastAssignedAt: 'asc' }],
    });

    if (!wallet) throw new AppError(`Không có ví ${network} khả dụng trong rotation pool`, 503);

    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { lastAssignedAt: new Date(), assignedCount: { increment: 1 } },
    });

    return wallet;
  }

  async pinWalletToMerchant(merchantId: string, walletId: string) {
    return prisma.merchantWallet.upsert({
      where: { merchantId_walletId: { merchantId, walletId } },
      update: { isActive: true },
      create: { merchantId, walletId, isActive: true },
    });
  }

  async unpinWallet(merchantId: string, walletId: string) {
    return prisma.merchantWallet.updateMany({
      where: { merchantId, walletId },
      data: { isActive: false },
    });
  }

  async setRotationStatus(walletId: string, inRotation: boolean) {
    return prisma.wallet.update({ where: { id: walletId }, data: { inRotation } });
  }

  async getRotationStats() {
    const wallets = await prisma.wallet.findMany({
      where: { type: WalletType.HOT },
      select: { id: true, address: true, label: true, isActive: true, inRotation: true, assignedCount: true, lastAssignedAt: true, balance: true },
      orderBy: { assignedCount: 'desc' },
    });
    return wallets;
  }
}
