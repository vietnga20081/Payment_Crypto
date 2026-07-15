import axios from 'axios';
import { logger } from './logger';

const BOT_TOKEN = process.env.ALERT_TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.ALERT_TELEGRAM_CHAT_ID;

// Chống spam: cùng 1 key cảnh báo chỉ gửi lại sau COOLDOWN_MS
const COOLDOWN_MS = Number(process.env.ALERT_COOLDOWN_MS) || 10 * 60 * 1000;
const lastSentAt = new Map<string, number>();

export type AlertLevel = 'info' | 'warning' | 'critical';

const LEVEL_EMOJI: Record<AlertLevel, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  critical: '🔴',
};

/**
 * Gửi cảnh báo tới Telegram. Nếu chưa cấu hình ALERT_TELEGRAM_BOT_TOKEN /
 * ALERT_TELEGRAM_CHAT_ID thì chỉ log ra console, không throw lỗi — để hệ
 * thống hoạt động bình thường kể cả khi chưa bật tính năng cảnh báo.
 *
 * @param key      Định danh duy nhất cho loại cảnh báo (dùng để chống spam lặp lại)
 * @param message  Nội dung cảnh báo
 * @param level    Mức độ nghiêm trọng
 */
export async function sendAlert(key: string, message: string, level: AlertLevel = 'warning'): Promise<void> {
  const now = Date.now();
  const last = lastSentAt.get(key);
  if (last && now - last < COOLDOWN_MS) {
    return; // đang trong thời gian cooldown, bỏ qua để tránh spam
  }
  lastSentAt.set(key, now);

  const fullMessage = `${LEVEL_EMOJI[level]} [Crypto Gateway] ${message}`;
  logger[level === 'critical' ? 'error' : level === 'warning' ? 'warn' : 'info']('ALERT', { key, message });

  if (!BOT_TOKEN || !CHAT_ID) {
    logger.warn('Chưa cấu hình ALERT_TELEGRAM_BOT_TOKEN/ALERT_TELEGRAM_CHAT_ID — chỉ ghi log, không gửi Telegram');
    return;
  }

  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: fullMessage,
      parse_mode: 'HTML',
    }, { timeout: 5000 });
  } catch (err) {
    logger.error('Gửi cảnh báo Telegram thất bại', { error: (err as Error).message });
  }
}

/** Xoá cooldown của 1 key — dùng khi muốn gửi lại cảnh báo ngay (ví dụ báo đã khôi phục) */
export function clearAlertCooldown(key: string): void {
  lastSentAt.delete(key);
}
