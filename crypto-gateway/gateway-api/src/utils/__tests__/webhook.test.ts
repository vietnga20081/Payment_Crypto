import { describe, it, expect } from 'vitest';
import { generateWebhookSignature, verifyWebhookSignature } from '../webhook';

describe('webhook signature', () => {
  const secret = 'test_webhook_secret_12345';
  const payload = { event: 'payment.completed', transactionId: 'tx_1', amount: 100 };

  it('sinh ra chữ ký hex 64 ký tự (sha256)', () => {
    const sig = generateWebhookSignature(payload, secret);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('chữ ký hợp lệ phải xác minh thành công', () => {
    const sig = generateWebhookSignature(payload, secret);
    expect(verifyWebhookSignature(payload, secret, sig)).toBe(true);
  });

  it('payload bị sửa đổi phải xác minh thất bại', () => {
    const sig = generateWebhookSignature(payload, secret);
    const tampered = { ...payload, amount: 999 };
    expect(verifyWebhookSignature(tampered, secret, sig)).toBe(false);
  });

  it('secret sai phải xác minh thất bại', () => {
    const sig = generateWebhookSignature(payload, secret);
    expect(verifyWebhookSignature(payload, 'wrong_secret', sig)).toBe(false);
  });

  it('chữ ký ngắn/hỏng không được làm crash (không throw), chỉ trả về false', () => {
    expect(() => verifyWebhookSignature(payload, secret, 'abc')).not.toThrow();
    expect(verifyWebhookSignature(payload, secret, 'abc')).toBe(false);
  });

  it('chữ ký rỗng không được làm crash', () => {
    expect(() => verifyWebhookSignature(payload, secret, '')).not.toThrow();
    expect(verifyWebhookSignature(payload, secret, '')).toBe(false);
  });

  it('chữ ký chứa ký tự không phải hex không được làm crash', () => {
    const notHex = 'z'.repeat(64);
    expect(() => verifyWebhookSignature(payload, secret, notHex)).not.toThrow();
    expect(verifyWebhookSignature(payload, secret, notHex)).toBe(false);
  });
});
