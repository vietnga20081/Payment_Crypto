import 'dotenv/config';
import { PrismaClient, TransactionStatus, EnvironmentMode, NetworkType } from '@prisma/client';
import Redis from 'ioredis';
import TronWeb from 'tronweb';
import axios from 'axios';
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

const tronWeb = new (TronWeb as unknown as new (cfg: object) => {
  trx: { getTransaction: (hash: string) => Promise<{
    ret?: Array<{ contractRet: string }>;
    blockNumber: number;
  } | null> };
  getCurrentBlock: () => Promise<{ block_header: { raw_data: { number: number } } }>;
})({
  fullHost: process.env.TRON_NODE_URL || 'https://api.trongrid.io',
  headers: { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY || '' },
});

const USDT_CONTRACT = process.env.USDT_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL_MS) || 3000;
const CONFIRM_POLL = Number(process.env.CONFIRMATION_POLL_MS) || 10000;
const TRON_API = process.env.TRON_NODE_URL || 'https://api.trongrid.io';
const API_KEY = process.env.TRON_API_KEY || '';

// ── Fetch TRC20 transfers for a wallet address ──────────────────────────────
async function fetchTRC20Transfers(address: string, minTimestamp: number): Promise<Array<{
  transaction_id: string;
  from: string;
  to: string;
  value: string;
  block_timestamp: number;
}>> {
  try {
    const res = await axios.get(`${TRON_API}/v1/accounts/${address}/transactions/trc20`, {
      params: {
        contract_address: USDT_CONTRACT,
        only_confirmed: false,
        limit: 50,
        min_timestamp: minTimestamp,
      },
      headers: { 'TRON-PRO-API-KEY': API_KEY },
    });
    return res.data?.data || [];
  } catch (err) {
    logger.error('fetchTRC20Transfers error', { address, error: (err as Error).message });
    return [];
  }
}

// ── Get on-chain confirmation count ─────────────────────────────────────────
async function getConfirmations(txHash: string): Promise<number> {
  try {
    const tx = await tronWeb.trx.getTransaction(txHash);
    if (!tx || tx.ret?.[0]?.contractRet !== 'SUCCESS') return 0;
    const currentBlock = await tronWeb.getCurrentBlock();
    const currentHeight = currentBlock.block_header.raw_data.number;
    return Math.max(0, currentHeight - tx.blockNumber);
  } catch {
    return 0;
  }
}

// ── Process incoming USDT transfer ──────────────────────────────────────────
async function processTransfer(transfer: {
  transaction_id: string;
  from: string;
  to: string;
  value: string;
  block_timestamp: number;
}) {
  const toAddress = transfer.to;
  const txHash = transfer.transaction_id;
  const amountRaw = BigInt(transfer.value);
  const amount = Number(amountRaw) / 1_000_000; // USDT has 6 decimals

  // Find matching pending transaction
  const tx = await prisma.transaction.findFirst({
    where: {
      toAddress,
      network: NetworkType.TRC20,
      status: { in: [TransactionStatus.PENDING, TransactionStatus.CONFIRMING] },
      expiredAt: { gt: new Date() },
    },
    include: { merchant: true },
  });

  if (!tx) return;

  // Amount must match within 0.01 tolerance
  if (Math.abs(Number(tx.amount) - amount) > 0.01) {
    logger.warn('Amount mismatch', { txHash, expected: tx.amount, received: amount });
    return;
  }

  const alreadyProcessed = await redis.get(`processed:${txHash}`);
  if (alreadyProcessed) return;

  logger.info('Processing transfer', { txHash, amount, merchantId: tx.merchantId });

  // Mark as confirming and store txHash
  await prisma.transaction.update({
    where: { id: tx.id },
    data: { txHash, status: TransactionStatus.CONFIRMING, fromAddress: transfer.from },
  });

  // Emit socket event via Redis pub/sub
  await redis.publish('transaction:update', JSON.stringify({
    id: tx.id,
    merchantId: tx.merchantId,
    status: TransactionStatus.CONFIRMING,
    txHash,
    amount,
  }));

  await redis.set(`processed:${txHash}`, '1', 'EX', 86400);
}

// ── Poll for new incoming transfers ─────────────────────────────────────────
async function pollIncoming() {
  const pendingTxs = await prisma.transaction.findMany({
    where: {
      status: TransactionStatus.PENDING,
      environment: EnvironmentMode.LIVE,
      network: NetworkType.TRC20,
      toAddress: { not: null },
      expiredAt: { gt: new Date() },
    },
    select: { toAddress: true, createdAt: true },
    distinct: ['toAddress'],
  });

  for (const { toAddress, createdAt } of pendingTxs) {
    if (!toAddress) continue;
    const minTs = createdAt.getTime() - 60_000;
    const transfers = await fetchTRC20Transfers(toAddress, minTs);
    for (const transfer of transfers) {
      await processTransfer(transfer);
    }
  }

  // Expire overdue pending transactions (chỉ giao dịch TRC20 — BEP20 do bsc-listener tự lo,
  // giao dịch chưa chọn mạng do job expire-unselected.job.ts ở gateway-api tự lo)
  const expired = await prisma.transaction.updateMany({
    where: { status: TransactionStatus.PENDING, network: NetworkType.TRC20, expiredAt: { lt: new Date() } },
    data: { status: TransactionStatus.EXPIRED },
  });
  if (expired.count > 0) {
    logger.info(`Expired ${expired.count} pending transactions`);
  }
}

// ── Poll confirmation counts for CONFIRMING transactions ────────────────────
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
    where: { status: TransactionStatus.CONFIRMING, txHash: { not: null } },
    include: { merchant: true },
  });

  const settingRow = await prisma.systemSetting.findUnique({ where: { key: 'required_confirmations' } });
  const required = Number(settingRow?.value) || 20;

  for (const tx of confirming) {
    if (!tx.txHash) continue;

    const confirmations = await getConfirmations(tx.txHash);
    logger.info('Confirmations', { txHash: tx.txHash, confirmations, required });

    if (confirmations >= required) {
      // Complete the transaction
      await prisma.$transaction(async (prismaTx) => {
        await prismaTx.transaction.update({
          where: { id: tx.id },
          data: {
            status: TransactionStatus.COMPLETED,
            confirmations,
            confirmedAt: new Date(),
          },
        });

        // Credit merchant balance
        await prismaTx.merchant.update({
          where: { id: tx.merchantId },
          data: { balance: { increment: tx.netAmount } },
        });
      });

      logger.info('Transaction completed', { txId: tx.id, merchantId: tx.merchantId });
      await creditReferralCommission({ id: tx.id, merchantId: tx.merchantId, fee: tx.fee });

      // Notify via Redis pub/sub
      await redis.publish('transaction:update', JSON.stringify({
        id: tx.id,
        merchantId: tx.merchantId,
        status: TransactionStatus.COMPLETED,
        txHash: tx.txHash,
        amount: tx.amount,
        netAmount: tx.netAmount,
        fee: tx.fee,
      }));

      // Queue webhook
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
            status: TransactionStatus.COMPLETED,
            confirmedAt: new Date(),
          },
        }));
      }
    } else {
      // Update confirmation count
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

// ── Auto-sweep eligible hot wallets to cold storage ─────────────────────────
async function pollSweep() {
  const sweepSetting = await prisma.systemSetting.findUnique({ where: { key: 'sweep_threshold' } });
  const threshold = Number(sweepSetting?.value) || 500;

  const coldWallet = await prisma.wallet.findFirst({ where: { type: 'COLD', isActive: true } });
  if (!coldWallet) return; // No cold wallet configured — skip silently

  const eligible = await prisma.wallet.findMany({
    where: { type: 'HOT', isActive: true, balance: { gte: threshold } },
  });

  for (const wallet of eligible) {
    logger.info('Wallet eligible for sweep', { walletId: wallet.id, balance: wallet.balance });
    await redis.publish('sweep:eligible', JSON.stringify({ walletId: wallet.id, balance: wallet.balance }));
  }
}

// ── Main loop ────────────────────────────────────────────────────────────────
async function run() {
  await prisma.$connect();
  logger.info('Tron listener started');

  let incomingRunning = false;
  let confirmRunning = false;
  let sweepRunning = false;

  setInterval(async () => {
    if (incomingRunning) return;
    incomingRunning = true;
    try {
      await pollIncoming();
      // Ghi heartbeat để gateway-api (watchdog) biết listener còn sống
      await redis.set('heartbeat:tron-listener', Date.now().toString());
    } catch (e) { logger.error('pollIncoming error', { error: (e as Error).message }); }
    finally { incomingRunning = false; }
  }, POLL_INTERVAL);

  setInterval(async () => {
    if (confirmRunning) return;
    confirmRunning = true;
    try { await pollConfirmations(); } catch (e) { logger.error('pollConfirmations error', { error: (e as Error).message }); }
    finally { confirmRunning = false; }
  }, CONFIRM_POLL);

  // Check sweep eligibility every 10 minutes (actual sweep execution stays in gateway-api for key custody separation)
  setInterval(async () => {
    if (sweepRunning) return;
    sweepRunning = true;
    try { await pollSweep(); } catch (e) { logger.error('pollSweep error', { error: (e as Error).message }); }
    finally { sweepRunning = false; }
  }, 10 * 60 * 1000);

  process.on('SIGTERM', async () => {
    logger.info('Shutting down tron-listener...');
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
  });
}

run().catch((err) => {
  logger.error('Fatal error', { error: err.message });
  process.exit(1);
});
