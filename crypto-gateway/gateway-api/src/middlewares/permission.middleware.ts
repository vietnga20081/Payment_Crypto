import { Request, Response, NextFunction } from 'express';
import { PermissionService } from '../modules/permissions/services/permission.service';
import { ForbiddenError } from '../utils/errors';

const service = new PermissionService();

export const requirePermission = (resource: string, action: 'view' | 'create' | 'edit' | 'delete' | 'approve') => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new ForbiddenError());
      if (req.user.role === 'SUPER_ADMIN') return next();

      const allowed = await service.hasPermission(req.user.userId, resource, action);
      if (!allowed) return next(new ForbiddenError(`Bạn không có quyền ${action} đối với ${resource}`));
      next();
    } catch (err) {
      next(err);
    }
  };
};
