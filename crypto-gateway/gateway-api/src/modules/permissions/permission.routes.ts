import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../prisma/client';
import { PermissionService } from './services/permission.service';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { sendSuccess } from '../../utils/response';
import { body } from 'express-validator';
import { validate } from '../../middlewares/validation.middleware';
import { ConflictError } from '../../utils/errors';

const router = Router();
const service = new PermissionService();

// Only SUPER_ADMIN can manage other admins
router.get('/', authenticate, authorize('SUPER_ADMIN'), async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.listAdmins()); } catch (e) { next(e); }
});

router.post('/', authenticate, authorize('SUPER_ADMIN'),
  [body('email').isEmail(), body('password').isLength({ min: 8 }), body('role').isIn(['ADMIN', 'OPERATOR'])],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.user.findUnique({ where: { email: req.body.email } });
      if (existing) throw new ConflictError('Email đã tồn tại');

      const hashed = await bcrypt.hash(req.body.password, 10);
      const user = await prisma.user.create({
        data: { email: req.body.email, password: hashed, role: req.body.role },
        select: { id: true, email: true, role: true, status: true, createdAt: true },
      });
      sendSuccess(res, user, 'Tạo admin thành công', 201);
    } catch (e) { next(e); }
  }
);

router.put('/:id/status', authenticate, authorize('SUPER_ADMIN'),
  [body('status').isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED'])], validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await service.assertMutable(req.user!.userId, req.params.id);
      await prisma.user.update({ where: { id: req.params.id }, data: { status: req.body.status } });
      sendSuccess(res, null, 'Đã cập nhật trạng thái');
    } catch (e) { next(e); }
  }
);

router.put('/:id', authenticate, authorize('SUPER_ADMIN'),
  [
    body('email').optional().isEmail(),
    body('role').optional().isIn(['ADMIN', 'OPERATOR']),
  ], validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await service.assertMutable(req.user!.userId, req.params.id);

      if (req.body.email) {
        const existing = await prisma.user.findFirst({ where: { email: req.body.email, id: { not: req.params.id } } });
        if (existing) throw new ConflictError('Email đã được dùng bởi tài khoản khác');
      }

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { email: req.body.email, role: req.body.role },
        select: { id: true, email: true, role: true, status: true, lastLoginAt: true, createdAt: true },
      });
      sendSuccess(res, user, 'Đã cập nhật admin');
    } catch (e) { next(e); }
  }
);

router.put('/:id/reset-password', authenticate, authorize('SUPER_ADMIN'),
  [body('newPassword').isLength({ min: 8 })], validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await service.assertMutable(req.user!.userId, req.params.id);
      const hashed = await bcrypt.hash(req.body.newPassword, 10);
      await prisma.user.update({ where: { id: req.params.id }, data: { password: hashed } });
      // Thu hồi hết refresh token hiện có — buộc đăng nhập lại bằng mật khẩu mới
      await prisma.refreshToken.deleteMany({ where: { userId: req.params.id } });
      sendSuccess(res, null, 'Đã đặt lại mật khẩu');
    } catch (e) { next(e); }
  }
);

router.delete('/:id', authenticate, authorize('SUPER_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await service.assertMutable(req.user!.userId, req.params.id);
      // Soft delete: giữ lại lịch sử (audit log, transaction đã duyệt...) nhưng
      // khoá hẳn tài khoản và thu hồi phiên đăng nhập.
      await prisma.user.update({
        where: { id: req.params.id },
        data: { deletedAt: new Date(), status: 'INACTIVE' },
      });
      await prisma.refreshToken.deleteMany({ where: { userId: req.params.id } });
      sendSuccess(res, null, 'Đã xóa admin');
    } catch (e) { next(e); }
  }
);

router.get('/:id/permissions', authenticate, authorize('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.getPermissions(req.params.id)); } catch (e) { next(e); }
});

router.put('/:id/permissions', authenticate, authorize('SUPER_ADMIN'),
  [body('permissions').isArray()], validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.setPermissions(req.params.id, req.body.permissions);
      sendSuccess(res, result, 'Đã cập nhật phân quyền');
    } catch (e) { next(e); }
  }
);

export default router;
