import { Response } from 'express';

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ApiResponse {
  static success<T>(
    res: Response,
    data: T,
    message = 'Succès',
    statusCode = 200
  ): Response {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static paginated<T>(
    res: Response,
    data: T[],
    meta: PaginationMeta,
    message = 'Succès'
  ): Response {
    return res.status(200).json({
      success: true,
      message,
      data,
      meta,
    });
  }

  static created<T>(res: Response, data: T, message = 'Créé avec succès'): Response {
    return ApiResponse.success(res, data, message, 201);
  }

  static noContent(res: Response): Response {
    return res.status(204).send();
  }

  static error(res: Response, statusCode: number, message: string, errors?: unknown): Response {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
    });
  }
}

// Helper for pagination
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// Helper for pagination query params
export function parsePaginationParams(query: Record<string, unknown>): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '10'), 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
