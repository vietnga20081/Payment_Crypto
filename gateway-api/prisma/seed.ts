import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('Admin@123456', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@gateway.com' },
    update: {},
    create: {
      email: 'admin@gateway.com',
      password: hashedPassword,
      role: UserRole.SUPER_ADMIN,
    },
  });

  await prisma.feeConfig.upsert({
    where: { id: 'default-fee' },
    update: {},
    create: {
      id: 'default-fee',
      name: 'Default Fee',
      description: 'Default transaction fee',
      rate: 0.01,
      minFee: 1,
      isDefault: true,
      isActive: true,
    },
  });

  const defaultSettings = [
    { key: 'required_confirmations', value: '20', type: 'number', group: 'blockchain' },
    { key: 'payment_expiry_minutes', value: '30', type: 'number', group: 'payment' },
    { key: 'withdrawal_fee_rate', value: '0.005', type: 'number', group: 'fee' },
    { key: 'default_merchant_fee_rate', value: '0.01', type: 'number', group: 'fee' },
    // Chương trình giới thiệu (Referral)
    { key: 'referral_enabled', value: 'false', type: 'string', group: 'referral' },
    { key: 'referral_commission_rate', value: '0.1', type: 'number', group: 'referral' },
    { key: 'referral_duration_days', value: '0', type: 'number', group: 'referral' },
    { key: 'referral_daily_cap', value: '0', type: 'number', group: 'referral' },
    { key: 'min_withdrawal_amount', value: '10', type: 'number', group: 'withdrawal' },
    // Ghi chú phí mạng blockchain — chỉ mang tính tham khảo cho khách hàng (khách tự trả
    // bằng TRX/BNB từ ví của họ, KHÔNG trừ vào số USDT chuyển). Admin tự cập nhật định kỳ
    // vì phí mạng thực tế biến động theo tình trạng tắc nghẽn mạng.
    { key: 'trc20_network_fee_note', value: '~1-5 TRX (khoảng $0.3-1) — trả bằng TRX trong ví của bạn, không trừ vào USDT', type: 'string', group: 'fee' },
    { key: 'bep20_network_fee_note', value: '~0.0005-0.001 BNB (khoảng $0.3-0.6) — trả bằng BNB trong ví của bạn, không trừ vào USDT', type: 'string', group: 'fee' },
    { key: 'dual_approval_threshold', value: '1000', type: 'number', group: 'withdrawal' },
    { key: 'sweep_threshold', value: '500', type: 'number', group: 'wallet' },
    { key: 'sweep_min_amount', value: '50', type: 'number', group: 'wallet' },
    { key: 'tron_node_url', value: 'https://api.trongrid.io', type: 'string', group: 'blockchain' },
    { key: 'usdt_contract_address', value: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', type: 'string', group: 'blockchain' },
    // Tích hợp Telegram + Email — dùng cho OTP xác thực export private key (2 kênh bắt buộc)
    { key: 'telegram_bot_token', value: '', type: 'password', group: 'integrations' },
    { key: 'smtp_host', value: 'smtp.gmail.com', type: 'string', group: 'integrations' },
    { key: 'smtp_port', value: '587', type: 'number', group: 'integrations' },
    { key: 'smtp_secure', value: 'false', type: 'string', group: 'integrations' },
    { key: 'smtp_user', value: '', type: 'string', group: 'integrations' },
    { key: 'smtp_pass', value: '', type: 'password', group: 'integrations' },
    { key: 'smtp_from', value: '', type: 'string', group: 'integrations' },
  ];

  for (const setting of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('Seed completed.');
  console.log('Super Admin:', admin.email, '/ Admin@123456');
  console.log('⚠️  Đổi mật khẩu ngay sau khi đăng nhập lần đầu!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
