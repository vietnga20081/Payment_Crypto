import 'dotenv/config';
import { PrismaClient, TransactionStatus, EnvironmentMode, NetworkType } from '@prisma/client';
import Redis from 'ioredis';
import { ethers } from 'ethers';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org';
const USDT_CONTRACT_ADDRESS = process.env.USDT_BEP20_CONTRACT || '0x55d398326f99059fF775485246999027B3197955';
const USDT_DECIMALS = 18; // Binance-Peg USDT (BEP20) dùng 18 số thập phân, khác với TRC20 (6)
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL_MS) || 3000;
const CONFIRM_POLL = Number(process.env.CONFIRMATION_POLL_MS) || 10000;
// Giới hạn phạm vi quét log mỗi lần để tránh quá tải RPC công khai khi service
// vừa khởi động lại sau thời gian dài offline (bù chỉ tối đa ~2000 block ~ 100 phút)
const MAX_BLOCK_RANGE = 2000;

const ERC20_TRANSFER_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, ERC20_TRANSFER_ABI, provider);

// ── Get on-chain confirmation count for a tx hash ───────────────────────────
async function getConfirmations(txHash: string): Promise<number> {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) return 0;
    const currentBlock = await provider.getBlockNumber();
    return Math.max(0, currentBlock - receipt.blockNumber);
  } catch {
    return 0;
  }
}

// ── Process incoming USDT-BEP20 transfer ────────────────────────────────────
async function processTransfer(transfer: {
  txHash: string;
  from: string;
  to: string;
  value: bigint;
}) {
  const toAddress = transfer.to; // giữ nguyên dạng checksummed (EIP-55) khớp với wallet.address đã lưu
  const txHash = transfer.txHash;
  const amount = Number(ethers.formatUnits(transfer.value, USDT_DECIMALS));

  const tx = await prisma.transaction.findFirst({
    where: {
      network: NetworkType.BEP20,
      status: { in: [TransactionStatus.PENDING, TransactionStatus.CONFIRMING] },
      expiredAt: { gt: new Date() },
      toAddress: toAddress,
    },
    include: { merchant: true },
  });

  if (!tx) return;

  if (Math.abs(Number(tx.amount) - amount) > 0.01) {
    logger.warn('Amount mismatch', { txHash, expected: tx.amount, received: amount });
    return;
  }

  const alreadyProcessed = await redis.get(`processed:${txHash}`);
  if (alreadyProcessed) return;

  logger.info('Processing transfer', { txHash, amount, merchantId: tx.merchantId });

  await prisma.transaction.update({
    where: { id: tx.id },
    data: { txHash, status: TransactionStatus.CONFIRMING, fromAddress: transfer.from },
  });

  await redis.publish('transaction:update', JSON.stringify({
    id: tx.id,
    merchantId: tx.merchantId,
    status: TransactionStatus.CONFIRMING,
    txHash,
    amount,
  }));

  await redis.set(`processed:${txHash}`, '1', 'EX', 86400);
}

// ── Poll for new incoming USDT-BEP20 transfers ──────────────────────────────
async function pollIncoming() {
  const pendingTxs = await prisma.transaction.findMany({
    where: {
      status: TransactionStatus.PENDING,
      environment: EnvironmentMode.LIVE,
      network: NetworkType.BEP20,
      toAddress: { not: null },
      expiredAt: { gt: new Date() },
    },
    select: { toAddress: true },
    distinct: ['toAddress'],
  });

  const currentBlock = await provider.getBlockNumber();
  const lastBlockRaw = await redis.get('bsc:last_block');
  const lastBlock = lastBlockRaw ? Number(lastBlockRaw) : currentBlock - 1;
  const fromBlock = Math.max(lastBlock + 1, currentBlock - MAX_BLOCK_RANGE);

  if (fromBlock <= currentBlock && pendingTxs.length > 0) {
    const addressSet = new Set(
      pendingTxs
        .map((t) => t.toAddress)
        .filter((addr): addr is string => addr !== null)
        .map((addr) => addr.toLowerCase())
    );

    const events = await usdtContract.queryFilter(
      usdtContract.filters.Transfer(),
      fromBlock,
      currentBlock
    );

    for (const ev of events) {
      if (!('args' in ev) || !ev.args) continue;
      const to = String(ev.args[1]).toLowerCase();
      if (!addressSet.has(to)) continue;

      await processTransfer({
        txHash: ev.transactionHash,
        from: String(ev.args[0]),
        to: String(ev.args[1]),
        value: BigInt(ev.args[2]),
      });
    }
  }

  await redis.set('bsc:last_block', currentBlock.toString());

  // Expire overdue pending transactions on BSC (LIVE + SANDBOX handled by tron-listener too,
  // but running it here as well is harmless/idempotent since it's a plain updateMany by status)
  const expired = await prisma.transaction.updateMany({
    where: { status: TransactionStatus.PENDING, network: NetworkType.BEP20, expiredAt: { lt: new Date() } },
    data: { status: TransactionStatus.EXPIRED },
  });
  if (expired.count > 0) {
    logger.info(`Expired ${expired.count} pending BEP20 transactions`);
  }
}

// ── Poll confirmation counts for CONFIRMING BEP20 transactions ──────────────
// ── Chương trình giới thiệu (Referral) — cộng hoa hồng cho người giới thiệu ──
// Chỉ chạy khi bật referral_enabled trong System Settings. Idempotent nhờ
// unique constraint trên ReferralCommission.transactionId — chạy lại (do
// restart giữa chừng) sẽ không bị cộng trùng, chỉ ghi log lỗi rồi bỏ qua.
async function creditReferralCommission(tx: { id: string; merchantId: string; fee: unknown }) {
  try {
    const enabledSetting = await prisma.systemSetting.findUnique({ where: { key: 'referral_enabled' } });
    if (enabledSetting?.value !== 'true') return;

    const merchant = await prisma.merchant.findUnique({ where: { id: tx.merchantId } });
    if (!merchant?.referredByMerchantId) return;

    const durationSetting = await prisma.systemSetting.findUnique({ where: { key: 'referral_duration_days' } });
    const durationDays = Number(durationSetting?.value) || 0;
    if (durationDays > 0) {
      const ageMs = Date.now() - merchant.createdAt.getTime();
      if (ageMs > durationDays * 24 * 60 * 60 * 1000) return; // hết hạn hưởng hoa hồng
    }

    const rateSetting = await prisma.systemSetting.findUnique({ where: { key: 'referral_commission_rate' } });
    const rate = Number(rateSetting?.value) || 0;
    if (rate <= 0) return;

    const commissionAmount = Number(tx.fee) * rate;
    if (commissionAmount <= 0) return;

    // Giới hạn hoa hồng/ngày cho mỗi người giới thiệu — chống farming bằng
    // cách tạo nhiều tài khoản ảo tự giới thiệu nhau rồi bơm giao dịch liên tục.
    const capSetting = await prisma.systemSetting.findUnique({ where: { key: 'referral_daily_cap' } });
    const dailyCap = Number(capSetting?.value) || 0;
    if (dailyCap > 0) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayTotal = await prisma.referralCommission.aggregate({
        where: { referrerMerchantId: merchant.referredByMerchantId!, createdAt: { gte: todayStart } },
        _sum: { amount: true },
      });
      const alreadyEarnedToday = Number(todayTotal._sum.amount || 0);
      if (alreadyEarnedToday >= dailyCap) {
        logger.warn('Referral daily cap reached, skip commission', { referrerMerchantId: merchant.referredByMerchantId, alreadyEarnedToday, dailyCap });
        return;
      }
    }

    await prisma.$transaction(async (t) => {
      await t.referralCommission.create({
        data: {
          referrerMerchantId: merchant.referredByMerchantId!,
          referredMerchantId: merchant.id,
          transactionId: tx.id,
          amount: commissionAmount,
          commissionRate: rate,
        },
      });
      await t.merchant.update({
        where: { id: merchant.referredByMerchantId! },
        data: { balance: { increment: commissionAmount } },
      });
    });

    logger.info('Referral commission credited', { transactionId: tx.id, referrerMerchantId: merchant.referredByMerchantId, commissionAmount });
  } catch (err) {
    logger.error('creditReferralCommission error', { error: (err as Error).message, transactionId: tx.id });
  }
}

async function pollConfirmations() {
  const confirming = await prisma.transaction.findMany({
    where: { status: TransactionStatus.CONFIRMING, network: NetworkType.BEP20, txHash: { not: null } },
    include: { merchant: true },
  });

  const settingRow = await prisma.systemSetting.findUnique({ where: { key: 'required_confirmations_bep20' } });
  // BSC có thời gian tạo block ngắn hơn TRON nhiều (~3s) nên mặc định số block yêu cầu
  // cao hơn một chút để đạt độ an toàn tương đương; có thể chỉnh riêng qua System Settings.
  const required = Number(settingRow?.value) || 15;

  for (const tx of confirming) {
    if (!tx.txHash) continue;

    const confirmations = await getConfirmations(tx.txHash);
    logger.info('Confirmations', { txHash: tx.txHash, confirmations, required });

    if (confirmations >= required) {
      await prisma.$transaction(async (prismaTx) => {
        await prismaTx.transaction.update({
          where: { id: tx.id },
          data: {
            status: TransactionStatus.COMPLETED,
            confirmations,
            confirmedAt: new Date(),
          },
        });

        await prismaTx.merchant.update({
          where: { id: tx.merchantId },
          data: { balance: { increment: tx.netAmount } },
        });
      });

      logger.info('Transaction completed', { txId: tx.id, merchantId: tx.merchantId });
      await creditReferralCommission({ id: tx.id, merchantId: tx.merchantId, fee: tx.fee });

      await redis.publish('transaction:update', JSON.stringify({
        id: tx.id,
        merchantId: tx.merchantId,
        status: TransactionStatus.COMPLETED,
        txHash: tx.txHash,
        amount: tx.amount,
        netAmount: tx.netAmount,
        fee: tx.fee,
      }));

      if (tx.merchant.callbackUrl) {
        await redis.lpush('webhook:queue', JSON.stringify({
          transactionId: tx.id,
          merchantId: tx.merchantId,
          callbackUrl: tx.merchant.callbackUrl,
          secret: tx.merchant.webhookSecret,
          payload: {
            event: 'payment.completed',
            transactionId: tx.id,
            orderId: tx.orderId,
            amount: tx.amount,
            fee: tx.fee,
            netAmount: tx.netAmount,
            txHash: tx.txHash,
            network: 'BEP20',
            status: TransactionStatus.COMPLETED,
            confirmedAt: new Date(),
          },
        }));
      }
    } else {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { confirmations },
      });

      await redis.publish('transaction:update', JSON.stringify({
        id: tx.id,
        merchantId: tx.merchantId,
        status: TransactionStatus.CONFIRMING,
        confirmations,
        required,
      }));
    }
  }
}

// ── Check hot wallet sweep eligibility (thực thi sweep vẫn nằm ở gateway-api) ─
// Lưu ý: sweep tự động cho BEP20 CHƯA được hỗ trợ ở gateway-api (cần chữ ký EVM
// riêng, phí gas trả bằng BNB thay vì TRX/feeLimit) — sự kiện này chỉ mang tính
// cảnh báo để admin sweep thủ công cho tới khi tính năng đó được triển khai.
async function pollSweep() {
  const sweepSetting = await prisma.systemSetting.findUnique({ where: { key: 'sweep_threshold' } });
  const threshold = Number(sweepSetting?.value) || 500;

  const eligible = await prisma.wallet.findMany({
    where: { type: 'HOT', network: NetworkType.BEP20, isActive: true, balance: { gte: threshold } },
  });

  for (const wallet of eligible) {
    logger.info('BEP20 wallet eligible for manual sweep', { walletId: wallet.id, balance: wallet.balance });
    await redis.publish('sweep:eligible', JSON.stringify({ walletId: wallet.id, balance: wallet.balance, network: 'BEP20', manualOnly: true }));
  }
}

// ── Main loop ────────────────────────────────────────────────────────────────
async function run() {
  await prisma.$connect();
  logger.info('BSC listener started', { rpc: RPC_URL, contract: USDT_CONTRACT_ADDRESS });

  let incomingRunning = false;
  let confirmRunning = false;
  let sweepRunning = false;

  setInterval(async () => {
    if (incomingRunning) return;
    incomingRunning = true;
    try {
      await pollIncoming();
      await redis.set('heartbeat:bsc-listener', Date.now().toString());
    } catch (e) { logger.error('pollIncoming error', { error: (e as Error).message }); }
    finally { incomingRunning = false; }
  }, POLL_INTERVAL);

  setInterval(async () => {
    if (confirmRunning) return;
    confirmRunning = true;
    try { await pollConfirmations(); } catch (e) { logger.error('pollConfirmations error', { error: (e as Error).message }); }
    finally { confirmRunning = false; }
  }, CONFIRM_POLL);

  setInterval(async () => {
    if (sweepRunning) return;
    sweepRunning = true;
    try { await pollSweep(); } catch (e) { logger.error('pollSweep error', { error: (e as Error).message }); }
    finally { sweepRunning = false; }
  }, 10 * 60 * 1000);

  process.on('SIGTERM', async () => {
    logger.info('Shutting down bsc-listener...');
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
  });
}

run().catch((err) => {
  logger.error('Fatal error', { error: err.message });
  process.exit(1);
});
