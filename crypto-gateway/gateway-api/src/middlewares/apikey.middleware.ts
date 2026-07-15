import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';
import { UnauthorizedError } from '../utils/errors';
import crypto from 'crypto';
import { getRequestIp } from './ipwhitelist.middleware';
import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      apiEnvironment?: 'LIVE' | 'SANDBOX';
    }
  }
}

export const apiKeyAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const apiKey = req.headers['x-api-key'] as string;
  const apiSecret = req.headers['x-api-secret'] as string;

  if (!apiKey || !apiSecret) {
    return next(new UnauthorizedError('API key and secret required'));
  }

  try {
    const key = await prisma.apiKey.findFirst({
      where: { key: apiKey, isActive: true, deletedAt: null },
      include: { merchant: true },
    });

    if (!key) return next(new UnauthorizedError('Invalid API key'));

    const hashedSecret = crypto.createHash('sha256').update(apiSecret).digest('hex');
    if (key.secret !== hashedSecret) return next(new UnauthorizedError('Invalid API secret'));

    if (key.merchant.status !== 'ACTIVE') {
      return next(new UnauthorizedError('Merchant account is not active'));
    }

    // IP restriction check (only applies to LIVE keys)
    if (key.environment === 'LIVE' && key.merchant.ipRestrictionEnabled) {
      const clientIp = getRequestIp(req);
      const allowed = await prisma.ipWhitelist.findFirst({
        where: { merchantId: key.merchantId, ipAddress: clientIp, isActive: true },
      });
      if (!allowed) {
        return next(new UnauthorizedError(`IP ${clientIp} không được phép gọi API`));
      }
    }

    await prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date(), lastUsedIp: getRequestIp(req) },
    });

    req.user = {
      userId: key.merchant.userId,
      email: '',
      role: UserRole.MERCHANT,
      merchantId: key.merchantId,
    };
    req.apiEnvironment = key.environment;
    next();
  } catch (err) {
    next(err);
  }
};
