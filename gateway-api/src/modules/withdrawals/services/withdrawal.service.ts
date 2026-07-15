import { prisma } from '../../../prisma/client';
import { AppError, NotFoundError, ForbiddenError } from '../../../utils/errors';
import { getPagination, getPaginationMeta } from '../../../utils/response';
import { Prisma, WithdrawalStatus, UserStatus, NetworkType, Withdrawal } from '@prisma/client';
import { PayoutService } from './payout.service';

const payoutService = new PayoutService();

export class WithdrawalService {
  async list(params: { page: number; limit: number; merchantId?: string; status?: string }) {
    const { skip, take } = getPagination(params.page, params.limit);
    const where: Prisma.WithdrawalWhereInput = {
      ...(params.merchantId && { merchantId: params.merchantId }),
      ...(params.status && { status: params.status as WithdrawalStatus }),
    };
    const [data, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where, skip, take,
        include: {
          merchant: { select: { name: true } },
          approvals: { include: { user: { select: { email: true } } }, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.withdrawal.count({ where }),
    ]);
    return { data, meta: getPaginationMeta(total, params.page, params.limit) };
  }

  async create(merchantId: string, data: { toAddress: string; amount: number; note?: string; network?: NetworkType }) {
    const merchant = await prisma.merchant.findFirst({ where: { id: merchantId, status: UserStatus.ACTIVE } });
    if (!merchant) throw new AppError('Merchant not found', 404);

    const network = data.network || NetworkType.TRC20;

    const setting = await prisma.systemSetting.findUnique({ where: { key: 'min_withdrawal_amount' } });
    const minAmount = Number(setting?.value) || 10;
    if (data.amount < minAmount) throw new AppError(`Minimum withdrawal is ${minAmount} USDT`, 400);

    // Daily limit check
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayTotal = await prisma.withdrawal.aggregate({
      where: { merchantId, createdAt: { gte: today }, status: { not: WithdrawalStatus.REJECTED } },
      _sum: { amount: true },
    });
    const usedToday = Number(todayTotal._sum.amount || 0);
    if (usedToday + data.amount > Number(merchant.dailyWithdrawalLimit)) {
      throw new AppError(`Vượt hạn mức rút trong ngày (${merchant.dailyWithdrawalLimit} USDT)`, 400);
    }

    const feeSetting = await prisma.systemSetting.findUnique({ where: { key: 'withdrawal_fee_rate' } });
    const feeRate = Number(feeSetting?.value) || 0.005;
    const fee = data.amount * feeRate;
    const netAmount = data.amount - fee;
    const totalDeduct = data.amount;

    if (Number(merchant.balance) < totalDeduct) throw new AppError('Insufficient balance', 400);

    // Dual approval threshold — large withdrawals always require 2 approvers
    const dualApprovalThreshold = 1000;
    const requiresDualApproval = data.amount >= dualApprovalThreshold;

    return prisma.$transaction(async (tx) => {
      await tx.merchant.update({
        where: { id: merchantId },
        data: {
          balance: { decrement: totalDeduct },
          frozenBalance: { increment: totalDeduct },
        },
      });
      return tx.withdrawal.create({
        data: {
          merchantId,
          toAddress: data.toAddress,
          amount: data.amount,
          fee,
          netAmount,
          note: data.note,
          network,
          status: WithdrawalStatus.PENDING,
          requiresDualApproval,
        },
      });
    });
  }

  /**
   * Step approval. If dual approval required: 1st approver moves to APPROVED_L1,
   * 2nd DIFFERENT approver moves to PROCESSING (ready for payout).
   * Single approval merchants go straight to PROCESSING.
   */
  async approve(id: string, adminUserId: string) {
    const w = await prisma.withdrawal.findUnique({ where: { id }, include: { approvals: true } });
    if (!w) throw new NotFoundError('Withdrawal not found');

    if (!w.requiresDualApproval) {
      if (w.status !== WithdrawalStatus.PENDING) throw new AppError('Withdrawal is not pending', 400);
      await prisma.withdrawalApproval.create({
        data: { withdrawalId: id, userId: adminUserId, step: 1, action: 'APPROVED' },
      });
      const updated = await prisma.withdrawal.update({ where: { id }, data: { status: WithdrawalStatus.PROCESSING } });
      return this.finalizePayout(updated);
    }

    // Dual approval flow
    if (w.status === WithdrawalStatus.PENDING) {
      await prisma.withdrawalApproval.create({
        data: { withdrawalId: id, userId: adminUserId, step: 1, action: 'APPROVED' },
      });
      return prisma.withdrawal.update({ where: { id }, data: { status: WithdrawalStatus.APPROVED_L1 } });
    }

    if (w.status === WithdrawalStatus.APPROVED_L1) {
      const alreadyApproved = w.approvals.some((a) => a.userId === adminUserId && a.action === 'APPROVED');
      if (alreadyApproved) {
        throw new ForbiddenError('Người duyệt bước 1 không thể duyệt bước 2 (yêu cầu 2 người khác nhau)');
      }
      await prisma.withdrawalApproval.create({
        data: { withdrawalId: id, userId: adminUserId, step: 2, action: 'APPROVED' },
      });
      const updated = await prisma.withdrawal.update({ where: { id }, data: { status: WithdrawalStatus.PROCESSING } });
      return this.finalizePayout(updated);
    }

    throw new AppError(`Không thể duyệt withdrawal ở trạng thái ${w.status}`, 400);
  }

  async reject(id: string, adminUserId: string, reason?: string) {
    const w = await prisma.withdrawal.findUnique({ where: { id } });
    if (!w) throw new NotFoundError('Withdrawal not found');
    const rejectableStatuses: WithdrawalStatus[] = [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED_L1];
    if (!rejectableStatuses.includes(w.status)) {
      throw new AppError('Withdrawal không ở trạng thái có thể từ chối', 400);
    }

    return prisma.$transaction(async (tx) => {
      await tx.merchant.update({
        where: { id: w.merchantId },
        data: {
          balance: { increment: w.amount },
          frozenBalance: { decrement: w.amount },
        },
      });
      await tx.withdrawalApproval.create({
        data: { withdrawalId: id, userId: adminUserId, step: w.status === WithdrawalStatus.PENDING ? 1 : 2, action: 'REJECTED', reason },
      });
      return tx.withdrawal.update({
        where: { id },
        data: { status: WithdrawalStatus.REJECTED, note: reason },
      });
    });
  }

  /**
   * Được gọi tự động ngay sau khi withdrawal chuyển sang PROCESSING (duyệt xong).
   * Thực thi payout on-chain thật — thành công thì hoàn tất luôn (COMPLETED +
   * txHash thật), thất bại thì GIỮ NGUYÊN ở PROCESSING (tiền vẫn đang bị đóng
   * băng trong frozenBalance, không mất) để admin retry hoặc xử lý thủ công.
   * Không throw ra ngoài — approve() vẫn trả về withdrawal object bình thường
   * dù payout tự động có thành công hay không, để không làm hỏng UX duyệt.
   */
  private async finalizePayout(withdrawal: Withdrawal) {
    const result = await payoutService.executePayout(withdrawal);
    if (!result.success) {
      return withdrawal; // vẫn ở PROCESSING — xem retryPayout() hoặc markCompleted() thủ công
    }

    return prisma.$transaction(async (tx) => {
      await tx.merchant.update({
        where: { id: withdrawal.merchantId },
        data: { frozenBalance: { decrement: withdrawal.amount } },
      });
      return tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: WithdrawalStatus.COMPLETED, txHash: result.txHash, processedAt: new Date() },
      });
    });
  }

  /**
   * Cho admin bấm "Thử lại" khi payout tự động thất bại lần đầu (vd: hết RPC
   * tạm thời, ví nguồn chưa kịp nạp đủ số dư...). Chỉ áp dụng cho withdrawal
   * đang ở PROCESSING và chưa có txHash.
   */
  async retryPayout(id: string) {
    const w = await prisma.withdrawal.findUnique({ where: { id } });
    if (!w) throw new NotFoundError('Withdrawal not found');
    if (w.status !== WithdrawalStatus.PROCESSING) throw new AppError('Chỉ retry được withdrawal đang ở PROCESSING', 400);
    if (w.txHash) throw new AppError('Withdrawal này đã có txHash, không cần retry', 400);

    return this.finalizePayout(w);
  }

  /** Fallback thủ công: dùng khi payout tự động không khả thi (vd BEP20 lúc chưa có signer, hoặc admin muốn tự tay gửi ngoài hệ thống). */
  async markCompleted(id: string, txHash: string) {
    const w = await prisma.withdrawal.findUnique({ where: { id } });
    if (!w) throw new NotFoundError('Withdrawal not found');
    if (w.status !== WithdrawalStatus.PROCESSING) throw new AppError('Withdrawal chưa ở trạng thái PROCESSING', 400);

    return prisma.$transaction(async (tx) => {
      await tx.merchant.update({
        where: { id: w.merchantId },
        data: { frozenBalance: { decrement: w.amount } },
      });
      return tx.withdrawal.update({
        where: { id },
        data: { status: WithdrawalStatus.COMPLETED, txHash, processedAt: new Date() },
      });
    });
  }
}
