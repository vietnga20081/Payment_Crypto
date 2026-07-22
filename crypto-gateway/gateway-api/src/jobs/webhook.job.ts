import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
import { sendWebhook } from '../utils/webhook';
import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';

// BullMQ bundles its own ioredis internally and is strict about the
// connection type — passing a shared ioredis Redis instance causes a
// TS structural-typing conflict between the two bundled ioredis copies.
// Passing plain connection options avoids this and is the pattern
// BullMQ's own docs recommend.
const parseRedisUrl = () => {
  try {
    const u = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    return {
      host: u.hostname,
      port: Number(u.port) || 6379,
      password: u.password || undefined,
    };
  } catch {
    return { host: '127.0.0.1', port: 6379, password: undefined };
  }
};

const connection: ConnectionOptions = {
  ...parseRedisUrl(),
  maxRetriesPerRequest: null,
};

const JOB_OPTIONS = {
  attempts: Number(process.env.WEBHOOK_MAX_RETRIES) || 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
};

export const webhookQueue = new Queue('webhooks', { connection });

interface WebhookJobData {
  transactionId: string;
  merchantId: string;
  callbackUrl: string;
  secret: string;
  payload: object;
}

export const startWebhookWorker = (): Worker => {
  const worker = new Worker<WebhookJobData>(
    'webhooks',
    async (job: Job<WebhookJobData>) => {
      const { transactionId, merchantId, callbackUrl, secret, payload } = job.data;
      const attempt = job.attemptsMade + 1; // BullMQ đếm từ 0 — +1 để khớp với "lần thử thứ mấy" cho dễ hiểu
      const result = await sendWebhook(callbackUrl, payload, secret, attempt);

      await prisma.webhookDeliveryLog.create({
        data: {
          transactionId,
          merchantId,
          attempt,
          url: callbackUrl,
          success: result.success,
          statusCode: result.statusCode,
          responseBody: result.responseBody,
          errorMessage: result.errorMessage,
          durationMs: result.durationMs,
        },
      });

      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          webhookAttempts: { increment: 1 },
          ...(result.success && { webhookSentAt: new Date() }),
        },
      });

      if (!result.success) throw new Error('Webhook delivery failed');
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    logger.error(`Webhook job failed`, { jobId: job?.id, error: err.message });
  });

  return worker;
};

export const scheduleWebhook = async (data: WebhookJobData): Promise<void> => {
  await webhookQueue.add('send', data, JOB_OPTIONS);
};
