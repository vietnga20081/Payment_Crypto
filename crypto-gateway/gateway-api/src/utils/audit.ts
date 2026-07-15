import { prisma } from '../prisma/client';
import { logger } from './logger';

interface AuditEntry {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Ghi 1 dòng vào bảng audit_logs. Không bao giờ throw ra ngoài — ghi audit
 * thất bại không được phép làm hỏng luồng nghiệp vụ chính, chỉ log lỗi lại.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        oldValue: entry.oldValue as never,
        newValue: entry.newValue as never,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  } catch (err) {
    logger.error('Ghi audit log thất bại', { error: (err as Error).message, action: entry.action });
  }
}
