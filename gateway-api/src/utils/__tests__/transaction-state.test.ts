import { describe, it, expect } from 'vitest';
import { TransactionStatus } from '@prisma/client';
import { canTransitionTransaction, assertCanTransitionTransaction } from '../transaction-state';

describe('transaction state machine', () => {
  it('cho phép các bước đi hợp lệ trong vòng đời thanh toán', () => {
    expect(canTransitionTransaction(TransactionStatus.PENDING, TransactionStatus.CONFIRMING)).toBe(true);
    expect(canTransitionTransaction(TransactionStatus.CONFIRMING, TransactionStatus.COMPLETED)).toBe(true);
    expect(canTransitionTransaction(TransactionStatus.PENDING, TransactionStatus.EXPIRED)).toBe(true);
    expect(canTransitionTransaction(TransactionStatus.CONFIRMING, TransactionStatus.FAILED)).toBe(true);
  });

  it('chặn các bước đi ngược / không hợp lệ', () => {
    expect(canTransitionTransaction(TransactionStatus.COMPLETED, TransactionStatus.PENDING)).toBe(false);
    expect(canTransitionTransaction(TransactionStatus.EXPIRED, TransactionStatus.CONFIRMING)).toBe(false);
    expect(canTransitionTransaction(TransactionStatus.COMPLETED, TransactionStatus.CONFIRMING)).toBe(false);
    expect(canTransitionTransaction(TransactionStatus.FAILED, TransactionStatus.COMPLETED)).toBe(false);
  });

  it('trạng thái cuối (COMPLETED/EXPIRED/FAILED) không được đi tiếp đâu cả', () => {
    for (const terminal of [TransactionStatus.COMPLETED, TransactionStatus.EXPIRED, TransactionStatus.FAILED]) {
      for (const target of Object.values(TransactionStatus)) {
        expect(canTransitionTransaction(terminal, target)).toBe(false);
      }
    }
  });

  it('assertCanTransitionTransaction throw khi bước đi không hợp lệ', () => {
    expect(() =>
      assertCanTransitionTransaction(TransactionStatus.COMPLETED, TransactionStatus.PENDING)
    ).toThrow();
  });

  it('assertCanTransitionTransaction không throw khi bước đi hợp lệ', () => {
    expect(() =>
      assertCanTransitionTransaction(TransactionStatus.PENDING, TransactionStatus.CONFIRMING)
    ).not.toThrow();
  });
});
