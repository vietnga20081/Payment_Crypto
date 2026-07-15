import { redis } from '../utils/redis';
import { webhookQueue } from './webhook.job';
import { sendAlert, clearAlertCooldown } from '../utils/alert';
import { logger } from '../utils/logger';

const CHECK_INTERVAL_MS = Number(process.env.WATCHDOG_INTERVAL_MS) || 60_000;
const HEARTBEAT_STALE_MS = Number(process.env.HEARTBEAT_STALE_THRESHOLD_MS) || 5 * 60_000;
const WEBHOOK_FAILED_THRESHOLD = Number(process.env.WEBHOOK_FAILED_ALERT_THRESHOLD) || 20;

// Mỗi listener (tron-listener, bsc-listener,...) tự ghi heartbeat của mình
// vào key riêng — watchdog chỉ cần biết tên key để theo dõi.
const LISTENERS = (process.env.WATCHDOG_LISTENERS || 'tron-listener')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

async function checkListenerHeartbeats() {
  for (const name of LISTENERS) {
    const key = `heartbeat:${name}`;
    const raw = await redis.get(key);
    const alertKey = `listener-down:${name}`;

    if (!raw) {
      await sendAlert(
        alertKey,
        `Chưa từng nhận được heartbeat từ <b>${name}</b>. Service có đang chạy không?`,
        'critical'
      );
      continue;
    }

    const lastSeen = Number(raw);
    const age = Date.now() - lastSeen;

    if (age > HEARTBEAT_STALE_MS) {
      await sendAlert(
        alertKey,
        `<b>${name}</b> không phản hồi ${Math.round(age / 1000)}s (ngưỡng ${Math.round(HEARTBEAT_STALE_MS / 1000)}s). ` +
        `Có thể listener bị treo, mất kết nối RPC, hoặc process đã chết — kiểm tra PM2 ngay.`,
        'critical'
      );
    } else {
      // Đã hồi phục — xoá cooldown để nếu rớt lại thì báo ngay, không phải chờ hết cooldown cũ
      clearAlertCooldown(alertKey);
    }
  }
}

async function checkWebhookQueueHealth() {
  try {
    const failedCount = await webhookQueue.getFailedCount();
    const alertKey = 'webhook-queue-backlog';

    if (failedCount > WEBHOOK_FAILED_THRESHOLD) {
      await sendAlert(
        alertKey,
        `Hàng đợi webhook có <b>${failedCount}</b> job thất bại (ngưỡng ${WEBHOOK_FAILED_THRESHOLD}). ` +
        `Merchant có thể không nhận được thông báo thanh toán — kiểm tra callback URL của merchant hoặc dashboard queue.`,
        'warning'
      );
    } else {
      clearAlertCooldown(alertKey);
    }
  } catch (err) {
    logger.error('watchdog: lỗi kiểm tra webhook queue', { error: (err as Error).message });
  }
}

export function startWatchdog(): void {
  logger.info('Watchdog started', { listeners: LISTENERS, intervalMs: CHECK_INTERVAL_MS });

  setInterval(async () => {
    try {
      await checkListenerHeartbeats();
      await checkWebhookQueueHealth();
    } catch (err) {
      logger.error('watchdog: lỗi không xác định', { error: (err as Error).message });
    }
  }, CHECK_INTERVAL_MS);
}
