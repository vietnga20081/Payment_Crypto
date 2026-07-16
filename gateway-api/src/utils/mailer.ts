import nodemailer from 'nodemailer';
import { prisma } from '../prisma/client';
import { logger } from './logger';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
  from: string;
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const keys = ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'smtp_from'];
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: keys } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  if (!map.smtp_host || !map.smtp_user || !map.smtp_pass) {
    return null; // Chưa cấu hình đủ trong Admin → Cài đặt → Tích hợp
  }

  return {
    host: map.smtp_host,
    port: Number(map.smtp_port) || 587,
    secure: map.smtp_secure === 'true',
    auth: { user: map.smtp_user, pass: map.smtp_pass },
    from: map.smtp_from || map.smtp_user,
  };
}

async function sendWithConfig(config: SmtpConfig, to: string, subject: string, html: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });
  await transporter.sendMail({ from: config.from, to, subject, html });
}

/**
 * Gửi email dùng config đã lưu trong System Settings. Trả về false (không throw)
 * nếu SMTP chưa được cấu hình, để nơi gọi tự quyết định cách xử lý.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const config = await getSmtpConfig();
  if (!config) {
    logger.warn('SMTP chưa được cấu hình trong System Settings — không gửi được email');
    return false;
  }

  try {
    await sendWithConfig(config, to, subject, html);
    return true;
  } catch (err) {
    logger.error('Gửi email thất bại', { error: (err as Error).message, to });
    return false;
  }
}

export async function isSmtpConfigured(): Promise<boolean> {
  return (await getSmtpConfig()) !== null;
}

/**
 * Test 1 cấu hình SMTP tùy ý (thường là giá trị đang gõ trên form, CHƯA lưu DB)
 * — verify kết nối trước rồi mới gửi email test, để admin biết chính xác lỗi
 * nằm ở đâu (sai host/port, sai auth, hay gửi thất bại) trước khi bấm Lưu.
 */
export async function testSmtpConfig(
  input: { host: string; port: number; secure: boolean; user: string; pass: string; from?: string },
  to: string
): Promise<{ success: boolean; error?: string }> {
  const config: SmtpConfig = {
    host: input.host,
    port: input.port,
    secure: input.secure,
    auth: { user: input.user, pass: input.pass },
    from: input.from || input.user,
  };

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
    await transporter.verify();
    await transporter.sendMail({
      from: config.from,
      to,
      subject: '[Crypto Gateway] Test SMTP thành công ✅',
      html: '<p>Đây là email test từ Admin → Cài đặt → Tích hợp. Nếu bạn nhận được email này, cấu hình SMTP đã hoạt động đúng.</p>',
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
