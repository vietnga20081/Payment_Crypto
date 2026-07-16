/**
 * Script chạy 1 lần để mã hoá các private key ví đang lưu dạng plaintext
 * (từ trước khi tính năng mã hoá at-rest được thêm vào).
 *
 * An toàn để chạy nhiều lần: những key đã mã hoá (có tiền tố "enc:v1:") sẽ
 * được bỏ qua, không mã hoá chồng lần 2.
 *
 * Cách chạy:
 *   cd gateway-api
 *   pnpm run encrypt-keys
 *
 * Yêu cầu: đã cấu hình WALLET_ENCRYPTION_KEY trong .env
 *   (tạo bằng: openssl rand -hex 32)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { encryptSecret, isEncrypted } from '../src/utils/crypto-vault';

const prisma = new PrismaClient();

async function main() {
  console.log('Đang quét toàn bộ ví trong DB...');
  const wallets = await prisma.wallet.findMany({ select: { id: true, address: true, network: true, privateKey: true } });

  let encrypted = 0;
  let alreadyDone = 0;

  for (const wallet of wallets) {
    if (isEncrypted(wallet.privateKey)) {
      alreadyDone++;
      continue;
    }

    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { privateKey: encryptSecret(wallet.privateKey) },
    });
    encrypted++;
    console.log(`  ✔ Đã mã hoá: ${wallet.address} (${wallet.network})`);
  }

  console.log('');
  console.log(`Hoàn tất: ${encrypted} ví vừa được mã hoá, ${alreadyDone} ví đã mã hoá từ trước.`);
  console.log(`Tổng cộng: ${wallets.length} ví.`);
}

main()
  .catch((err) => {
    console.error('Lỗi:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
