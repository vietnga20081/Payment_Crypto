import { prisma } from '../../../prisma/client';
import { Prisma, UserStatus } from '@prisma/client';

export class MerchantRepository {
  async findAll(params: {
    skip: number;
    take: number;
    search?: string;
    status?: string;
  }) {
    const where: Prisma.MerchantWhereInput = {
      deletedAt: null,
      ...(params.status && { status: params.status as UserStatus }),
      ...(params.search && {
        OR: [
          { name: { contains: params.search } },
          { user: { email: { contains: params.search } } },
        ],
      }),
    };
    const [data, total] = await Promise.all([
      prisma.merchant.findMany({
        where,
        skip: params.skip,
        take: params.take,
        include: { user: { select: { email: true, status: true, lastLoginAt: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.merchant.count({ where }),
    ]);
    return { data, total };
  }

  async findById(id: string) {
    return prisma.merchant.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { email: true, status: true, lastLoginAt: true } },
        referredBy: { select: { id: true, name: true, referralCode: true } },
      },
    });
  }

  async findByUserId(userId: string) {
    return prisma.merchant.findFirst({ where: { userId, deletedAt: null } });
  }

  async create(data: {
    userId: string;
    name: string;
    website?: string;
    callbackUrl?: string;
    webhookSecret: string;
    feeRate: number;
    referralCode: string;
    referredByMerchantId?: string;
  }) {
    return prisma.merchant.create({ data });
  }

  async update(id: string, data: Prisma.MerchantUpdateInput) {
    return prisma.merchant.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return prisma.merchant.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async updateBalance(id: string, amount: Prisma.Decimal, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.merchant.update({
      where: { id },
      data: { balance: { increment: amount } },
    });
  }
}
