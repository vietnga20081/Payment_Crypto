import crypto from 'crypto';
import axios from 'axios';
import { logger } from './logger';

export const generateWebhookSignature = (payload: object, secret: string): string => {
  const body = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
};

export const verifyWebhookSignature = (
  payload: object,
  secret: string,
  signature: string
): boolean => {
  const expected = generateWebhookSignature(payload, secret);
  const expectedBuf = Buffer.from(expected, 'hex');
  const signatureBuf = Buffer.from(signature, 'hex');
  // timingSafeEqual throws on length mismatch instead of returning false —
  // guard first so malformed/short signatures are safely rejected.
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
};

export const sendWebhook = async (
  url: string,
  payload: object,
  secret: string,
  attempt = 1
): Promise<boolean> => {
  const signature = generateWebhookSignature(payload, secret);
  try {
    await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Attempt': attempt.toString(),
      },
      timeout: Number(process.env.WEBHOOK_TIMEOUT_MS) || 5000,
    });
    return true;
  } catch (err) {
    logger.warn('Webhook delivery failed', { url, attempt, error: (err as Error).message });
    return false;
  }
};
