import { TransactionStatus } from '@prisma/client';

/**
 * Các trạng thái hợp lệ tiếp theo cho từng trạng thái hiện tại của Transaction.
 * Dùng để chặn việc set nhầm trạng thái (ví dụ COMPLETED -> PENDING) do bug logic
 * ở tron-listener/bsc-listener hoặc do race condition giữa các job.
 */
const ALLOWED_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  [TransactionStatus.PENDING]: [TransactionStatus.CONFIRMING, TransactionStatus.EXPIRED, TransactionStatus.FAILED],
  [TransactionStatus.CONFIRMING]: [TransactionStatus.COMPLETED, TransactionStatus.FAILED],
  [TransactionStatus.COMPLETED]: [],
  [TransactionStatus.EXPIRED]: [],
  [TransactionStatus.FAILED]: [],
};

export function canTransitionTransaction(from: TransactionStatus, to: TransactionStatus): boolean {
  if (from === to) return false; // no-op transition, không phải lỗi nhưng cũng không cần set lại
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertCanTransitionTransaction(from: TransactionStatus, to: TransactionStatus): void {
  if (!canTransitionTransaction(from, to)) {
    throw new Error(`Chuyển trạng thái giao dịch không hợp lệ: ${from} -> ${to}`);
  }
}
