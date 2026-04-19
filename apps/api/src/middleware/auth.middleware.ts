import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';
import { Role } from '@prisma/client';

// Augment Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Token d\'authentification manquant');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    throw ApiError.unauthorized('Token invalide ou expiré');
  }
}

// Role-based authorization — chain after authenticate()
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw ApiError.unauthorized();

    if (!roles.includes(req.user.role as Role)) {
      throw ApiError.forbidden('Vous n\'avez pas les permissions nécessaires');
    }
    next();
  };
}

// Ensure the user belongs to the requested agency
export function requireSameAgency(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw ApiError.unauthorized();

  // SUPER_ADMIN can access any agency
  if (req.user.role === Role.SUPER_ADMIN) {
    next();
    return;
  }

  const agencyIdParam = req.params.agencyId ?? req.body?.agencyId;
  if (agencyIdParam && agencyIdParam !== req.user.agencyId) {
    throw ApiError.forbidden('Accès à une autre agence refusé');
  }
  next();
}
