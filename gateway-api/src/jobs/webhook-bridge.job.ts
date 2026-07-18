import Redis from 'ioredis';
import { scheduleWebhook } from './webhook.job';
import { logger } from '../utils/logger';

/**
 * tron-listener và bsc-listener (chạy ở process/service riêng, không có BullMQ)
 * đẩy webhook cần gửi vào 1 Redis LIST thường qua `lpush('webhook:queue', ...)`.
 * Job này liên tục BRPOP từ list đó rồi forward vào BullMQ queue thật
 * (`scheduleWebhook`) — nơi worker chính (webhook.job.ts) xử lý gửi + retry
 * + ghi log delivery.
 *
 * ĐÂY LÀ FIX CHO 1 BUG CÓ SẴN: nếu thiếu bridge này, webhook cho giao dịch
 * hoàn tất qua on-chain thật (không phải sandbox) sẽ nằm im trong Redis list
 * mãi mãi, không bao giờ được gửi đi — vì worker chính chỉ nghe BullMQ, không
 * nghe list thường.
 */
export function startWebhookBridge(): void {
  // Dùng connection riêng cho BRPOP vì lệnh này block connection — không
  // được dùng chung với redis client chính đang phục vụ các request khác.
  const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  let running = true;

  const loop = async () => {
    while (running) {
      try {
        const result = await subscriber.brpop('webhook:queue', 5); // timeout 5s để có thể dừng loop khi cần
        if (!result) continue; // timeout, không có job mới — quay lại chờ tiếp

        const [, raw] = result;
        const data = JSON.parse(raw);

        await scheduleWebhook({
          transactionId: data.transactionId,
          merchantId: data.merchantId,
          callbackUrl: data.callbackUrl,
          secret: data.secret,
          payload: data.payload,
        });

        logger.info('Webhook bridged từ listener sang BullMQ queue', { transactionId: data.transactionId });
      } catch (err) {
        logger.error('webhook-bridge lỗi, thử lại sau 2s', { error: (err as Error).message });
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  };

  loop();

  process.on('SIGTERM', () => { running = false; subscriber.disconnect(); });
}
