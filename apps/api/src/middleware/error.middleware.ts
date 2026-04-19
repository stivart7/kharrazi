import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/ApiError';
import { logger } from '../config/logger';
import { Sentry } from '../config/sentry';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const key = e.path.join('.');
      errors[key] = errors[key] ?? [];
      errors[key].push(e.message);
    });

    res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors,
    });
    return;
  }

  // Prisma unique constraint violation
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const fields = (err.meta?.target as string[])?.join(', ') ?? 'champ';
      res.status(409).json({
        success: false,
        message: `Un enregistrement avec ce ${fields} existe déjà`,
      });
      return;
    }

    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Ressource introuvable',
      });
      return;
    }

    logger.error({ err, code: err.code }, 'Prisma error');
    res.status(500).json({ success: false, message: 'Erreur de base de données' });
    return;
  }

  // Known API errors
  if (err instanceof ApiError) {
    if (!err.isOperational) {
      logger.error({ err }, 'Non-operational error');
    }

    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
    });
    return;
  }

  // Unknown errors — send to Sentry then respond
  logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');
  Sentry.captureException(err, { extra: { url: req.url, method: req.method } });
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Erreur interne du serveur'
      : err.message,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} introuvable`,
  });
}
