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
  attempt: number;
}

export const startWebhookWorker = (): Worker => {
  const worker = new Worker<WebhookJobData>(
    'webhooks',
    async (job: Job<WebhookJobData>) => {
      const { transactionId, callbackUrl, secret, payload, attempt } = job.data;
      const success = await sendWebhook(callbackUrl, payload, secret, attempt);

      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          webhookAttempts: { increment: 1 },
          ...(success && { webhookSentAt: new Date() }),
        },
      });

      if (!success) throw new Error('Webhook delivery failed');
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    logger.error(`Webhook job failed`, { jobId: job?.id, error: err.message });
  });

  return worker;
};

export const scheduleWebhook = async (data: Omit<WebhookJobData, 'attempt'>): Promise<void> => {
  await webhookQueue.add('send', { ...data, attempt: 1 }, JOB_OPTIONS);
};
