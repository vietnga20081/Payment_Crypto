import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { prisma } from '../../prisma/client';
import { sendSuccess } from '../../utils/response';
import { NotFoundError } from '../../utils/errors';
import { validate } from '../../middlewares/validation.middleware';
import { TransactionService } from './services/transaction.service';

const router = Router();
const service = new TransactionService();

// Public endpoint — no auth, accessed by end customers paying
router.get('/:transactionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tx = await prisma.transaction.findUnique({
      where: { id: req.params.transactionId },
      select: {
        id: true,
        orderId: true,
        amount: true,
        fee: true,
        netAmount: true,
        toAddress: true,
        network: true,
        status: true,
        confirmations: true,
        requiredConfirmations: true,
        expiredAt: true,
        confirmedAt: true,
        returnUrl: true,
        environment: true,
      },
    });
    if (!tx) throw new NotFoundError('Giao dịch không tồn tại');

    // Ghi chú phí mạng — chỉ mang tính tham khảo, khách tự trả bằng TRX/BNB,
    // không trừ vào USDT. Trả cả 2 mạng để trang "chọn mạng" hiện được luôn,
    // dù giao dịch đã chọn mạng hay chưa.
    const feeNoteRows = await prisma.systemSetting.findMany({
      where: { key: { in: ['trc20_network_fee_note', 'bep20_network_fee_note'] } },
    });
    const feeNoteMap = Object.fromEntries(feeNoteRows.map((r) => [r.key, r.value]));

    sendSuccess(res, {
      ...tx,
      networkFeeNotes: {
        TRC20: feeNoteMap.trc20_network_fee_note || null,
        BEP20: feeNoteMap.bep20_network_fee_note || null,
      },
    });
  } catch (err) { next(err); }
});

// Khách hàng chọn mạng nhận tiền (TRC20/BEP20) ngay trên trang thanh toán —
// chỉ áp dụng cho giao dịch được Đại lý tạo mà KHÔNG chỉ định network sẵn.
router.post('/:transactionId/select-network', [body('network').isIn(['TRC20', 'BEP20'])], validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tx = await service.selectNetwork(req.params.transactionId, req.body.network);

      const feeNoteRows = await prisma.systemSetting.findMany({
        where: { key: { in: ['trc20_network_fee_note', 'bep20_network_fee_note'] } },
      });
      const feeNoteMap = Object.fromEntries(feeNoteRows.map((r) => [r.key, r.value]));

      sendSuccess(res, {
        ...tx,
        networkFeeNotes: {
          TRC20: feeNoteMap.trc20_network_fee_note || null,
          BEP20: feeNoteMap.bep20_network_fee_note || null,
        },
      }, 'Đã chọn mạng nhận tiền');
    } catch (err) { next(err); }
  }
);

export default router;
