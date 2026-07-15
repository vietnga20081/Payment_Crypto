import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { prisma } from '../../prisma/client';
import { sendSuccess, getPagination, getPaginationMeta } from '../../utils/response';
import { Request, Response, NextFunction } from 'express';

const router = Router();

router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 50, action, resource } = req.query;
    const { skip, take } = getPagination(+page, +limit);
    const where = {
      ...(action && { action: action as string }),
      ...(resource && { resource: resource as string }),
    };
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip, take,
        include: { user: { select: { email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);
    sendSuccess(res, data, 'OK', 200, getPaginationMeta(total, +page, +limit));
  } catch (err) { next(err); }
});

export default router;
