/**
 * Tính phí giao dịch và số tiền thực nhận (net amount).
 * Tách riêng thành hàm thuần để dễ unit test và tránh sai lệch làm tròn
 * giữa các nơi gọi (transaction.service, withdrawal.service, reports...).
 */
export function calculateFee(amount: number, feeRate: number): { fee: number; netAmount: number } {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Số tiền không hợp lệ');
  }
  if (!Number.isFinite(feeRate) || feeRate < 0 || feeRate > 1) {
    throw new Error('Tỉ lệ phí không hợp lệ (phải trong khoảng 0–1)');
  }

  // Làm tròn tới 6 chữ số thập phân (khớp @db.Decimal(20, 6) của USDT trong schema)
  const round6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

  const fee = round6(amount * feeRate);
  const netAmount = round6(amount - fee);

  return { fee, netAmount };
}
