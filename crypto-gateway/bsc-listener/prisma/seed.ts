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
    { key: 'min_withdrawal_amount', value: '10', type: 'number', group: 'withdrawal' },
    { key: 'dual_approval_threshold', value: '1000', type: 'number', group: 'withdrawal' },
    { key: 'sweep_threshold', value: '500', type: 'number', group: 'wallet' },
    { key: 'sweep_min_amount', value: '50', type: 'number', group: 'wallet' },
    { key: 'tron_node_url', value: 'https://api.trongrid.io', type: 'string', group: 'blockchain' },
    { key: 'usdt_contract_address', value: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', type: 'string', group: 'blockchain' },
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
