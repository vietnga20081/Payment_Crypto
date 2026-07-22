import { prisma } from '../../../prisma/client';
import { NotFoundError, AppError } from '../../../utils/errors';

const DEFAULT_RESOURCES = ['merchants', 'transactions', 'withdrawals', 'wallets', 'settings', 'reports', 'audit'];

export class PermissionService {
  /**
   * Chặn các thao tác nguy hiểm trước khi sửa/xóa/đổi trạng thái/reset mật khẩu 1 admin:
   * - Không cho tự thao tác lên chính mình qua panel này (tránh tự khoá/xoá/đổi role của mình)
   * - Không cho động vào tài khoản SUPER_ADMIN khác (kể cả SUPER_ADMIN gọi API cũng bị chặn,
   *   để tránh 2 SUPER_ADMIN vô tình khoá lẫn nhau)
   */
  async assertMutable(actingUserId: string, targetUserId: string): Promise<void> {
    if (actingUserId === targetUserId) {
      throw new AppError('Không thể tự thao tác lên chính tài khoản của bạn qua đây', 400);
    }
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target || target.deletedAt) throw new NotFoundError('Admin not found');
    if (target.role === 'SUPER_ADMIN') {
      throw new AppError('Không thể sửa/xóa/đổi trạng thái tài khoản SUPER_ADMIN', 403);
    }
  }

  async getPermissions(userId: string) {
    const perms = await prisma.adminPermission.findMany({ where: { userId } });
    // Fill missing resources with view-only defaults for UI consistency
    const map = new Map(perms.map((p) => [p.resource, p]));
    return DEFAULT_RESOURCES.map((resource) => map.get(resource) || {
      resource, canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false,
    });
  }

  async setPermissions(userId: string, permissions: Array<{
    resource: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; canApprove: boolean;
  }>) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    await Promise.all(permissions.map((p) =>
      prisma.adminPermission.upsert({
        where: { userId_resource: { userId, resource: p.resource } },
        update: { canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete, canApprove: p.canApprove },
        create: { userId, ...p },
      })
    ));

    return this.getPermissions(userId);
  }

  async hasPermission(userId: string, resource: string, action: 'view' | 'create' | 'edit' | 'delete' | 'approve'): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role === 'SUPER_ADMIN') return true; // Super admin bypasses granular checks

    const perm = await prisma.adminPermission.findUnique({
      where: { userId_resource: { userId, resource } },
    });
    if (!perm) return action === 'view'; // Default: view-only if not configured

    const fieldMap = { view: 'canView', create: 'canCreate', edit: 'canEdit', delete: 'canDelete', approve: 'canApprove' } as const;
    return perm[fieldMap[action]];
  }

  async listAdmins() {
    return prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'OPERATOR', 'SUPER_ADMIN'] }, deletedAt: null },
      select: { id: true, email: true, role: true, status: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
