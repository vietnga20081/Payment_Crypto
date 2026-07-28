import crypto from 'crypto';
import { prisma } from '../prisma/client';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ ký tự dễ nhầm: 0/O, 1/I/L

function randomCode(length = 7): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return code;
}

/**
 * Sinh mã giới thiệu duy nhất cho merchant (dùng khi tạo merchant mới, dù qua
 * Admin tạo tay hay merchant tự đăng ký). Thử lại tối đa 10 lần nếu trùng
 * (xác suất trùng cực thấp với 7 ký tự trong bộ 32 ký tự ~ 32^7).
 */
export async function generateReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const existing = await prisma.merchant.findUnique({ where: { referralCode: code } });
    if (!existing) return code;
  }
  throw new Error('Không thể sinh mã giới thiệu duy nhất, thử lại sau');
}
