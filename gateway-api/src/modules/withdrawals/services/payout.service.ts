import { prisma } from '../../../prisma/client';
import { logger } from '../../../utils/logger';
import { sendAlert } from '../../../utils/alert';
import { sendUsdtTrc20 } from '../../../services/chain/tron-signer';
import { sendUsdtBep20 } from '../../../services/chain/bsc-signer';
import { WalletType, NetworkType, Withdrawal } from '@prisma/client';

export class PayoutService {
  /**
   * Thực thi payout on-chain thật cho 1 withdrawal đã duyệt xong (PROCESSING).
   * Chọn ví nguồn có đủ số dư — ưu tiên ví COLD trước (thường giữ số dư dự trữ
   * lớn hơn, tách biệt khỏi dòng tiền HOT đang xử lý giao dịch khách hàng),
   * nếu COLD không đủ mới rơi xuống ví HOT.
   *
   * Không throw ra ngoài — luôn trả về kết quả { success, txHash?, error? } để
   * nơi gọi (withdrawal.service) tự quyết định cập nhật trạng thái phù hợp.
   */
  async executePayout(withdrawal: Withdrawal): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const candidates = await prisma.wallet.findMany({
      where: {
        network: withdrawal.network,
        isActive: true,
        type: { in: [WalletType.COLD, WalletType.HOT] },
        balance: { gte: withdrawal.amount },
      },
    });

    // Ưu tiên COLD trước HOT
    candidates.sort((a) => (a.type === WalletType.COLD ? -1 : 1));
    const sourceWallet = candidates[0];

    if (!sourceWallet) {
      const msg = `Không có ví ${withdrawal.network} nào đủ số dư (${withdrawal.amount} USDT) để trả rút tiền #${withdrawal.id}. Cần nạp thêm vào ví COLD/HOT hoặc sweep về.`;
      logger.error(msg);
      await sendAlert(`payout-insufficient-${withdrawal.network}`, msg, 'critical');
      return { success: false, error: msg };
    }

    try {
      const txHash = withdrawal.network === NetworkType.BEP20
        ? await sendUsdtBep20(sourceWallet.privateKey, withdrawal.toAddress, Number(withdrawal.amount))
        : await sendUsdtTrc20(sourceWallet.privateKey, withdrawal.toAddress, Number(withdrawal.amount));

      await prisma.wallet.update({
        where: { id: sourceWallet.id },
        data: { balance: { decrement: withdrawal.amount } },
      });

      logger.info('Payout executed', { withdrawalId: withdrawal.id, network: withdrawal.network, txHash, sourceWalletId: sourceWallet.id });
      return { success: true, txHash };
    } catch (err) {
      const errorMsg = (err as Error).message;
      const msg = `Payout thất bại cho rút tiền #${withdrawal.id} (${withdrawal.amount} USDT, ${withdrawal.network}): ${errorMsg}`;
      logger.error(msg);
      await sendAlert(`payout-failed-${withdrawal.id}`, msg, 'critical');
      return { success: false, error: errorMsg };
    }
  }
}
