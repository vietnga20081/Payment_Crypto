import { prisma } from '../../../prisma/client';
import { User, UserRole, Prisma } from '@prisma/client';

export class AuthRepository {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { email, deletedAt: null } });
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  async createUser(data: { email: string; password: string; role?: UserRole }): Promise<User> {
    return prisma.user.create({ data });
  }

  async updateLastLogin(id: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  async saveRefreshToken(userId: string, token: string, expiresAt: Date, ipAddress?: string, userAgent?: string): Promise<void> {
    await prisma.refreshToken.create({ data: { userId, token, expiresAt, ipAddress, userAgent } });
  }

  async findRefreshToken(token: string) {
    return prisma.refreshToken.findFirst({
      where: { token, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { token } });
  }

  async deleteUserRefreshTokens(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { userId } });
  }

  /** Danh sách phiên đăng nhập còn hiệu lực (session = 1 refresh token còn sống) */
  async listActiveSessions(userId: string) {
    return prisma.refreshToken.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  async deleteSessionById(userId: string, sessionId: string): Promise<boolean> {
    const result = await prisma.refreshToken.deleteMany({ where: { id: sessionId, userId } });
    return result.count > 0;
  }
}
