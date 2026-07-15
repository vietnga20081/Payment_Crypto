import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';
import { TransactionStatus } from '@prisma/client';

const CHECK_INTERVAL_MS = 60_000; // 1 phút

/**
 * tron-listener và bsc-listener đều tự dọn PENDING quá hạn CỦA MẠNG CỦA
 * CHÚNG (lọc theo network cụ thể) — nhưng giao dịch chưa được khách chọn
 * mạng (network = NULL, do Đại lý tạo mà không truyền network) sẽ không
 * khớp điều kiện lọc của bất kỳ listener nào. Job này dọn riêng nhóm đó.
 */
async function expireUnselectedTransactions() {
  const result = await prisma.transaction.updateMany({
    where: { status: TransactionStatus.PENDING, network: null, expiredAt: { lt: new Date() } },
    data: { status: TransactionStatus.EXPIRED },
  });
  if (result.count > 0) {
    logger.info(`Expired ${result.count} giao dịch chưa chọn mạng (quá hạn)`);
  }
}

export function startExpireUnselectedJob(): void {
  setInterval(() => {
    expireUnselectedTransactions().catch((err) =>
      logger.error('expireUnselectedTransactions error', { error: (err as Error).message })
    );
  }, CHECK_INTERVAL_MS);
}
