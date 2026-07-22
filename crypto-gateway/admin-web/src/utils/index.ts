import { TransactionStatus, WithdrawalStatus } from '../types';

export const formatUSDT = (value: string | number) =>
  `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;

export const formatDate = (date: string) =>
  new Date(date).toLocaleString('vi-VN', { hour12: false });

export const txStatusColor: Record<TransactionStatus, string> = {
  PENDING: 'orange',
  CONFIRMING: 'blue',
  COMPLETED: 'green',
  EXPIRED: 'red',
  FAILED: 'red',
};

export const txStatusLabel: Record<TransactionStatus, string> = {
  PENDING: 'Chờ thanh toán',
  CONFIRMING: 'Đang xác nhận',
  COMPLETED: 'Hoàn thành',
  EXPIRED: 'Hết hạn',
  FAILED: 'Thất bại',
};

export const wdStatusColor: Record<WithdrawalStatus, string> = {
  PENDING: 'orange',
  APPROVED_L1: 'cyan',
  PROCESSING: 'blue',
  COMPLETED: 'green',
  REJECTED: 'red',
  FAILED: 'red',
};

export const wdStatusLabel: Record<WithdrawalStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED_L1: 'Duyệt bước 1',
  PROCESSING: 'Đang xử lý',
  COMPLETED: 'Hoàn thành',
  REJECTED: 'Từ chối',
  FAILED: 'Thất bại',
};

export const shortAddress = (addr: string) =>
  addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : '-';

export const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};
