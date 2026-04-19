import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { ApiError } from '../utils/ApiError';

/**
 * Injects agencyId into req.body / req.query from the authenticated user.
 * SUPER_ADMIN can pass an explicit agencyId; other roles are locked to their own.
 */
export function injectTenant(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw ApiError.unauthorized();

  if (req.user.role === Role.SUPER_ADMIN) {
    // Super admin may specify any agencyId
    next();
    return;
  }

  if (!req.user.agencyId) {
    throw ApiError.forbidden('Utilisateur non associé à une agence');
  }

  // Lock all operations to the user's agency
  req.body = { ...req.body, agencyId: req.user.agencyId };
  next();
}

/** Extract agencyId for the current user (or from param for SUPER_ADMIN) */
export function getAgencyId(req: Request): string {
  if (req.user?.role === Role.SUPER_ADMIN) {
    // Use explicit param > query > body > user's own agencyId
    const id = req.params.agencyId ?? req.query.agencyId ?? req.body.agencyId ?? req.user.agencyId;
    if (!id) throw ApiError.badRequest('agencyId requis pour SUPER_ADMIN — associez votre compte à une agence');
    return id as string;
  }
  if (!req.user?.agencyId) throw ApiError.forbidden('Agence non trouvée');
  return req.user.agencyId;
}
