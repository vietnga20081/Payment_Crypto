import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: unknown;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: ApiResponse['meta']
): Response => {
  const body: Record<string, unknown> = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 400,
  errors?: unknown
): Response => {
  const body: Record<string, unknown> = { success: false, message };
  if (errors !== undefined) body.errors = errors;
  return res.status(statusCode).json(body);
};

export const getPagination = (page: number, limit: number) => {
  const skip = (page - 1) * limit;
  return { skip, take: limit };
};

export const getPaginationMeta = (total: number, page: number, limit: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});
