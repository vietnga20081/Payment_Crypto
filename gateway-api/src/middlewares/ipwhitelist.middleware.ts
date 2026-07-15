import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';
import { ForbiddenError } from '../utils/errors';

const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'] as string;
  return forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || '';
};

// Applies to merchant API-key routes only — checks if IP restriction is enabled
export const checkMerchantIpWhitelist = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const merchantId = req.user?.merchantId;
    if (!merchantId) return next();

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { ipRestrictionEnabled: true },
    });
    if (!merchant?.ipRestrictionEnabled) return next();

    const clientIp = getClientIp(req);
    const allowed = await prisma.ipWhitelist.findFirst({
      where: { merchantId, ipAddress: clientIp, isActive: true },
    });

    if (!allowed) {
      return next(new ForbiddenError(`IP ${clientIp} không nằm trong danh sách cho phép`));
    }
    next();
  } catch (err) {
    next(err);
  }
};

export const getRequestIp = getClientIp;
