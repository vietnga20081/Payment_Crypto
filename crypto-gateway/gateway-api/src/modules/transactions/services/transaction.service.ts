import { prisma } from '../../../prisma/client';
import { NotFoundError, AppError } from '../../../utils/errors';
import { getPagination, getPaginationMeta } from '../../../utils/response';
import { calculateFee } from '../../../utils/fee';
import { Prisma, TransactionStatus, EnvironmentMode, UserStatus, NetworkType } from '@prisma/client';
import { WalletRotationService } from '../../wallets/services/wallet-rotation.service';

const walletRotation = new WalletRotationService();

export class TransactionService {
  async list(params: {
    page: number;
    limit: number;
    merchantId?: string;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { skip, take } = getPagination(params.page, params.limit);
    const where: Prisma.TransactionWhereInput = {
      ...(params.merchantId && { merchantId: params.merchantId }),
      ...(params.status && { status: params.status as TransactionStatus }),
      ...(params.search && {
        OR: [
          { orderId: { contains: params.search } },
          { txHash: { contains: params.search } },
          { toAddress: { contains: params.search } },
        ],
      }),
      ...(params.startDate || params.endDate
        ? {
            createdAt: {
              ...(params.startDate && { gte: new Date(params.startDate) }),
              ...(params.endDate && { lte: new Date(params.endDate) }),
            },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take,
        include: { merchant: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where }),
    ]);
    return { data, meta: getPaginationMeta(total, params.page, params.limit) };
  }

  async getById(id: string) {
    const tx = await prisma.transaction.findUnique({
      where: { id },
      include: { merchant: { select: { name: true } } },
    });
    if (!tx) throw new NotFoundError('Transaction not found');
    return tx;
  }

  async create(merchantId: string, data: {
    orderId: string;
    amount: number;
    network?: NetworkType;
    metadata?: Record<string, unknown>;
    returnUrl?: string;
  }, environment: EnvironmentMode = EnvironmentMode.LIVE) {
    const merchant = await prisma.merchant.findFirst({ where: { id: merchantId, status: UserStatus.ACTIVE } });
    if (!merchant) throw new AppError('Merchant not active', 400);

    const existing = await prisma.transaction.findFirst({
      where: { merchantId, orderId: data.orderId, status: { in: [TransactionStatus.PENDING, TransactionStatus.CONFIRMING] } },
    });
    if (existing) throw new AppError('Order ID already has pending transaction', 409);

    const setting = await prisma.systemSetting.findUnique({ where: { key: 'payment_expiry_minutes' } });
    const expiryMinutes = Number(setting?.value) || 30;
    const { fee, netAmount } = calculateFee(Number(data.amount), Number(merchant.feeRate));
    const expiredAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // ── Đại lý KHÔNG truyền network: tạo giao dịch "chờ khách chọn mạng" ────
    // Chưa gán ví/toAddress — trang thanh toán sẽ hiện 2 lựa chọn TRC20/BEP20
    // cho khách, gán ví thật sự chỉ khi khách bấm chọn (xem selectNetwork()).
    if (!data.network) {
      return prisma.transaction.create({
        data: {
          merchantId,
          orderId: data.orderId,
          amount: data.amount,
          fee,
          netAmount,
          toAddress: null,
          network: null,
          status: TransactionStatus.PENDING,
          environment,
          metadata: data.metadata as Prisma.InputJsonValue,
          returnUrl: data.returnUrl,
          expiredAt,
        },
      });
    }

    const network = data.network;

    // ── Sandbox mode: simulate without touching real wallets ──────────────
    if (environment === EnvironmentMode.SANDBOX) {
      return prisma.transaction.create({
        data: {
          merchantId,
          orderId: data.orderId,
          amount: data.amount,
          fee,
          netAmount,
          toAddress: 'TSandboxAddressForTestingOnly00000',
          network,
          status: TransactionStatus.PENDING,
          environment: EnvironmentMode.SANDBOX,
          metadata: data.metadata as Prisma.InputJsonValue,
          returnUrl: data.returnUrl,
          expiredAt,
        },
      });
    }

    // ── Live mode: assign wallet via rotation pool (theo đúng network) ─────
    const wallet = await walletRotation.getNextWallet(merchantId, network);

    return prisma.transaction.create({
      data: {
        merchantId,
        walletId: wallet.id,
        orderId: data.orderId,
        amount: data.amount,
        fee,
        netAmount,
        toAddress: wallet.address,
        network,
        status: TransactionStatus.PENDING,
        environment: EnvironmentMode.LIVE,
        metadata: data.metadata as Prisma.InputJsonValue,
        returnUrl: data.returnUrl,
        expiredAt,
      },
    });
  }

  /**
   * Khách hàng chọn mạng (TRC20/BEP20) ngay trên trang thanh toán, cho các
   * giao dịch được Đại lý tạo mà KHÔNG chỉ định network từ trước. Gán ví thật
   * sự tại đây — chỉ được gọi 1 lần, gọi lại khi đã chọn rồi sẽ báo lỗi.
   */
  async selectNetwork(transactionId: string, network: NetworkType) {
    const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw new NotFoundError('Giao dịch không tồn tại');
    if (tx.network) throw new AppError('Giao dịch này đã chọn mạng rồi', 400);
    if (tx.status !== TransactionStatus.PENDING) throw new AppError('Giao dịch không còn ở trạng thái chờ', 400);
    if (tx.expiredAt < new Date()) throw new AppError('Giao dịch đã hết hạn', 400);

    if (tx.environment === EnvironmentMode.SANDBOX) {
      return prisma.transaction.update({
        where: { id: transactionId },
        data: { network, toAddress: 'TSandboxAddressForTestingOnly00000' },
      });
    }

    const wallet = await walletRotation.getNextWallet(tx.merchantId, network);
    return prisma.transaction.update({
      where: { id: transactionId },
      data: { network, toAddress: wallet.address, walletId: wallet.id },
    });
  }

  // Simulates instant completion for sandbox transactions (merchant testing)
  async simulateSandboxComplete(merchantId: string, transactionId: string) {
    const tx = await prisma.transaction.findFirst({
      where: { id: transactionId, merchantId, environment: EnvironmentMode.SANDBOX, status: TransactionStatus.PENDING },
    });
    if (!tx) throw new NotFoundError('Sandbox transaction not found or already processed');

    return prisma.$transaction(async (p) => {
      const updated = await p.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.COMPLETED,
          confirmations: tx.requiredConfirmations,
          txHash: `SANDBOX_${tx.id}`,
          confirmedAt: new Date(),
        },
      });
      await p.merchant.update({
        where: { id: merchantId },
        data: { sandboxBalance: { increment: tx.netAmount } },
      });
      return updated;
    });
  }

  async getStats(merchantId?: string) {
    const where = merchantId ? { merchantId } : {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, todayCount, completed, pending, volume] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.count({ where: { ...where, createdAt: { gte: today } } }),
      prisma.transaction.count({ where: { ...where, status: TransactionStatus.COMPLETED } }),
      prisma.transaction.count({ where: { ...where, status: TransactionStatus.PENDING } }),
      prisma.transaction.aggregate({
        where: { ...where, status: TransactionStatus.COMPLETED },
        _sum: { netAmount: true },
      }),
    ]);

    return { total, todayCount, completed, pending, totalVolume: volume._sum.netAmount || 0 };
  }
}
