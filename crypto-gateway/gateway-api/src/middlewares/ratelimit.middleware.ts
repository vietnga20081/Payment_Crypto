import { Request, Response, NextFunction } from 'express';
import { redis } from '../utils/redis';
import { AppError } from '../utils/errors';

// Sliding-window rate limit per merchant (or per IP if no merchant context)
export const merchantRateLimit = (opts: { windowSec: number; max: number }) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = req.user?.merchantId
        ? `ratelimit:merchant:${req.user.merchantId}`
        : `ratelimit:ip:${req.ip}`;

      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, opts.windowSec);
      }

      if (count > opts.max) {
        const ttl = await redis.ttl(key);
        throw new AppError(`Quá giới hạn request. Thử lại sau ${ttl}s`, 429);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};
