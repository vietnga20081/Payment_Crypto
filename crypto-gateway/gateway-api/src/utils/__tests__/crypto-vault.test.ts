import { describe, it, expect, beforeAll } from 'vitest';
import { encryptSecret, decryptSecret, isEncrypted } from '../crypto-vault';

describe('crypto-vault', () => {
  beforeAll(() => {
    // Key test cố định (32 bytes hex) — KHÔNG dùng key này cho production
    process.env.WALLET_ENCRYPTION_KEY = '0'.repeat(63) + '1';
  });

  it('mã hoá rồi giải mã phải ra đúng plaintext ban đầu', () => {
    const plaintext = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const encrypted = encryptSecret(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it('chuỗi đã mã hoá phải có tiền tố enc:v1: và isEncrypted() nhận diện đúng', () => {
    const encrypted = encryptSecret('some-private-key');
    expect(encrypted.startsWith('enc:v1:')).toBe(true);
    expect(isEncrypted(encrypted)).toBe(true);
  });

  it('chuỗi plaintext cũ (chưa mã hoá) phải được isEncrypted() nhận diện là false', () => {
    expect(isEncrypted('414243444546')).toBe(false);
  });

  it('decryptSecret() trên chuỗi CHƯA mã hoá phải trả về nguyên (tương thích ngược)', () => {
    const legacyPlaintext = '414243444546';
    expect(decryptSecret(legacyPlaintext)).toBe(legacyPlaintext);
  });

  it('2 lần mã hoá cùng 1 plaintext phải cho ra 2 chuỗi khác nhau (random IV)', () => {
    const a = encryptSecret('same-input');
    const b = encryptSecret('same-input');
    expect(a).not.toBe(b);
    // nhưng giải mã ra vẫn phải giống nhau
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it('giải mã với key sai phải throw (không được âm thầm trả sai dữ liệu)', () => {
    const encrypted = encryptSecret('secret-value');
    process.env.WALLET_ENCRYPTION_KEY = '9'.repeat(63) + '1';
    expect(() => decryptSecret(encrypted)).toThrow();
    process.env.WALLET_ENCRYPTION_KEY = '0'.repeat(63) + '1'; // khôi phục key đúng cho test khác
  });

  it('thiếu WALLET_ENCRYPTION_KEY phải throw lỗi rõ ràng', () => {
    const original = process.env.WALLET_ENCRYPTION_KEY;
    delete process.env.WALLET_ENCRYPTION_KEY;
    expect(() => encryptSecret('x')).toThrow(/WALLET_ENCRYPTION_KEY/);
    process.env.WALLET_ENCRYPTION_KEY = original;
  });
});
