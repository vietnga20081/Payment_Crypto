import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

function getKey(): Buffer {
  const keyHex = process.env.WALLET_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      'WALLET_ENCRYPTION_KEY chưa được cấu hình trong .env — không thể mã hoá/giải mã private key. ' +
      'Tạo key bằng: openssl rand -hex 32'
    );
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('WALLET_ENCRYPTION_KEY phải là chuỗi hex 64 ký tự (32 bytes). Tạo bằng: openssl rand -hex 32');
  }
  return key;
}

/**
 * Mã hoá 1 chuỗi bí mật (private key) bằng AES-256-GCM. Kết quả có tiền tố
 * "enc:v1:" để phân biệt với dữ liệu cũ chưa mã hoá (plaintext) trong lúc
 * migrate dần — decryptSecret() sẽ tự nhận diện định dạng nào.
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Giải mã. Nếu chuỗi đầu vào KHÔNG có tiền tố "enc:v1:" thì coi như dữ liệu cũ
 * (chưa migrate, vẫn còn plaintext) và trả về nguyên — đảm bảo hệ thống chạy
 * được ngay cả khi chưa chạy script encrypt-wallet-keys cho toàn bộ ví cũ.
 * Sau khi chắc chắn đã migrate hết, có thể xoá nhánh tương thích ngược này.
 */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) {
    return stored;
  }
  const key = getKey();
  const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function isEncrypted(stored: string): boolean {
  return stored.startsWith(PREFIX);
}
