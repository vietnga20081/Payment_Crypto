import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { redis } from '../utils/redis';
import { logger } from '../utils/logger';

const COMPLETED_TTL_SECONDS = 24 * 60 * 60; // giữ lại response 24h để trả lại khi merchant gọi lại
const PROCESSING_TTL_SECONDS = 60; // khoá tạm trong lúc xử lý — tránh 2 request cùng lúc lọt qua

interface CachedEntry {
  status: 'processing' | 'completed';
  bodyHash: string;
  statusCode?: number;
  response?: unknown;
}

/**
 * Middleware chống tạo trùng giao dịch khi merchant gọi lại API do timeout
 * mạng/mất kết nối. Merchant tự sinh 1 `Idempotency-Key` (khuyến khích UUID)
 * gửi kèm header, cùng 1 key + cùng request body → trả lại đúng kết quả cũ,
 * KHÔNG chạy lại logic nghiệp vụ (không tạo giao dịch thứ 2).
 *
 * Hoàn toàn TÙY CHỌN — không gửi header thì hoạt động như trước giờ, không
 * bắt buộc merchant phải đổi tích hợp sẵn có.
 */
export function idempotency() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.headers['idempotency-key'] as string | undefined;
    if (!key) return next();

    if (key.length > 200) {
      res.status(400).json({ success: false, message: 'Idempotency-Key quá dài (tối đa 200 ký tự)' });
      return;
    }

    const merchantId = req.user?.merchantId;
    if (!merchantId) return next(); // an toàn: chỉ áp dụng khi đã xác định được merchant

    const bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');
    const redisKey = `idempotency:${merchantId}:${key}`;

    try {
      const existingRaw = await redis.get(redisKey);
      if (existingRaw) {
        const existing: CachedEntry = JSON.parse(existingRaw);

        if (existing.bodyHash !== bodyHash) {
          res.status(409).json({
            success: false,
            message: 'Idempotency-Key này đã được dùng cho 1 request khác với nội dung khác. Dùng key mới cho request khác.',
          });
          return;
        }

        if (existing.status === 'processing') {
          res.status(409).json({
            success: false,
            message: 'Request với Idempotency-Key này đang được xử lý, vui lòng thử lại sau vài giây.',
          });
          return;
        }

        // Đã xử lý xong trước đó — trả lại đúng response cũ, KHÔNG chạy lại logic nghiệp vụ
        res.status(existing.statusCode || 200).json(existing.response);
        return;
      }

      // Chưa có — claim key này bằng "processing" (NX = chỉ set nếu chưa tồn tại,
      // chống race condition khi 2 request cùng Idempotency-Key tới gần như đồng thời)
      const claimed = await redis.set(
        redisKey,
        JSON.stringify({ status: 'processing', bodyHash } as CachedEntry),
        'EX', PROCESSING_TTL_SECONDS,
        'NX'
      );

      if (!claimed) {
        res.status(409).json({
          success: false,
          message: 'Request với Idempotency-Key này đang được xử lý, vui lòng thử lại sau vài giây.',
        });
        return;
      }
    } catch (err) {
      // Redis lỗi — không được để tính năng chống trùng làm sập luôn API tạo giao dịch,
      // bỏ qua idempotency cho lần gọi này và log lại để biết mà kiểm tra Redis.
      logger.error('idempotency middleware lỗi, bỏ qua kiểm tra', { error: (err as Error).message });
      return next();
    }

    // Hook vào res.json để lưu lại kết quả khi response được gửi đi.
    // Thành công (2xx) → cache 24h để trả lại khi gọi lại.
    // Lỗi (4xx/5xx) → xoá claim ngay, cho phép gọi lại với cùng key (vd: sau khi sửa lỗi input).
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
      const cacheOp = isSuccess
        ? redis.set(redisKey, JSON.stringify({ status: 'completed', bodyHash, statusCode: res.statusCode, response: body } as CachedEntry), 'EX', COMPLETED_TTL_SECONDS)
        : redis.del(redisKey);

      cacheOp.catch((err) => logger.error('idempotency: lỗi lưu cache response', { error: (err as Error).message }));
      return originalJson(body);
    }) as typeof res.json;

    next();
  };
}
