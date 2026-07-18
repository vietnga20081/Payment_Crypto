import { describe, it, expect } from 'vitest';
import { calculateFee } from '../fee';

describe('calculateFee', () => {
  it('tính đúng phí và net amount với tỉ lệ phí thông thường (1%)', () => {
    const { fee, netAmount } = calculateFee(100, 0.01);
    expect(fee).toBeCloseTo(1, 6);
    expect(netAmount).toBeCloseTo(99, 6);
  });

  it('tỉ lệ phí = 0 thì fee = 0 và netAmount = amount', () => {
    const { fee, netAmount } = calculateFee(50, 0);
    expect(fee).toBe(0);
    expect(netAmount).toBe(50);
  });

  it('tỉ lệ phí = 1 (100%) thì netAmount = 0', () => {
    const { fee, netAmount } = calculateFee(50, 1);
    expect(fee).toBe(50);
    expect(netAmount).toBe(0);
  });

  it('làm tròn đúng tới 6 chữ số thập phân, tránh lỗi số thực floating-point', () => {
    // 0.1 + 0.2 kiểu kinh điển gây lỗi floating point trong JS
    const { fee, netAmount } = calculateFee(0.3, 0.1);
    expect(fee).toBe(0.03);
    expect(netAmount).toBe(0.27);
  });

  it('fee + netAmount phải luôn bằng amount ban đầu', () => {
    const cases: Array<[number, number]> = [
      [123.456789, 0.025],
      [1, 0.003],
      [9999.999999, 0.5],
    ];
    for (const [amount, rate] of cases) {
      const { fee, netAmount } = calculateFee(amount, rate);
      expect(fee + netAmount).toBeCloseTo(amount, 5);
    }
  });

  it('amount âm phải throw lỗi', () => {
    expect(() => calculateFee(-10, 0.01)).toThrow();
  });

  it('feeRate ngoài khoảng [0,1] phải throw lỗi', () => {
    expect(() => calculateFee(100, 1.5)).toThrow();
    expect(() => calculateFee(100, -0.1)).toThrow();
  });

  it('amount không phải số hữu hạn (NaN/Infinity) phải throw lỗi', () => {
    expect(() => calculateFee(NaN, 0.01)).toThrow();
    expect(() => calculateFee(Infinity, 0.01)).toThrow();
  });
});
