import axios from 'axios';
import { prisma } from '../prisma/client';
import { logger } from './logger';

async function getBotToken(): Promise<string | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key: 'telegram_bot_token' } });
  return row?.value || null;
}

/**
 * Gửi tin nhắn tới 1 chat_id cụ thể (DM cho admin đó) qua bot đã cấu hình trong
 * Admin → Cài đặt → Tích hợp. Trả về false (không throw) nếu chưa cấu hình bot
 * hoặc gửi thất bại (vd: admin chưa /start với bot nên chat_id không hợp lệ).
 */
export async function sendTelegramDM(chatId: string, text: string): Promise<boolean> {
  const token = await getBotToken();
  if (!token) {
    logger.warn('Telegram bot token chưa được cấu hình trong System Settings');
    return false;
  }

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }, { timeout: 5000 });
    return true;
  } catch (err) {
    logger.error('Gửi Telegram DM thất bại', { error: (err as Error).message, chatId });
    return false;
  }
}

export async function isTelegramBotConfigured(): Promise<boolean> {
  return (await getBotToken()) !== null;
}

/**
 * Test 1 cặp bot token + chat_id tùy ý (thường là giá trị đang gõ trên form,
 * CHƯA lưu DB) — trả về lỗi thật từ Telegram API để admin biết chính xác sai
 * ở đâu (token sai, hay chat_id sai/chưa /start với bot).
 */
export async function testTelegramConfig(
  botToken: string,
  chatId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: '🔔 [Crypto Gateway] Test Telegram thành công ✅\n\nNếu bạn nhận được tin nhắn này, cấu hình bot + chat ID đã hoạt động đúng.',
      parse_mode: 'HTML',
    }, { timeout: 5000 });
    return { success: true };
  } catch (err) {
    const axiosErr = err as { response?: { data?: { description?: string } }; message: string };
    return { success: false, error: axiosErr.response?.data?.description || axiosErr.message };
  }
}
