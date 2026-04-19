import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { getPlanFeatures, PlanFeatures } from '../config/plan.config';
import { ApiError } from '../utils/ApiError';
import { Role } from '@prisma/client';

// ── Cache agency plan per request ─────────────
async function getAgencyPlan(agencyId: string): Promise<string> {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { plan: true },
  });
  return agency?.plan ?? 'basic';
}

// ── requireFeature middleware factory ──────────
export function requireFeature(
  feature: keyof Omit<PlanFeatures, 'maxVehicles' | 'maxUsers'>,
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // SUPER_ADMIN bypasses all plan checks
    if (req.user?.role === Role.SUPER_ADMIN) { next(); return; }

    const agencyId = req.user?.agencyId;
    if (!agencyId) { next(); return; }

    const plan     = await getAgencyPlan(agencyId);
    const features = getPlanFeatures(plan);

    if (!features[feature]) {
      const planMap: Record<string, string> = {
        maintenance:  'PRO ou ENTERPRISE',
        reports:      'PRO ou ENTERPRISE',
        ai_assistant: 'ENTERPRISE',
      };
      throw ApiError.forbidden(
        `Cette fonctionnalité nécessite un abonnement ${planMap[feature] ?? 'supérieur'}. ` +
        `Votre plan actuel: ${plan.toUpperCase()}.`
      );
    }

    next();
  };
}

// ── Vehicle limit guard ────────────────────────
export async function checkVehicleLimit(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.user?.role === Role.SUPER_ADMIN) { next(); return; }

  const agencyId = req.user?.agencyId;
  if (!agencyId) { next(); return; }

  const plan     = await getAgencyPlan(agencyId);
  const features = getPlanFeatures(plan);

  if (features.maxVehicles === null) { next(); return; } // unlimited

  const count = await prisma.car.count({
    where: { agencyId, isActive: true },
  });

  if (count >= features.maxVehicles) {
    throw ApiError.forbidden(
      `Limite de véhicules atteinte (${features.maxVehicles} max pour le plan ${plan.toUpperCase()}). ` +
      `Passez à un plan supérieur pour ajouter plus de véhicules.`
    );
  }

  next();
}

// ── User limit guard ───────────────────────────
export async function checkUserLimit(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.user?.role === Role.SUPER_ADMIN) { next(); return; }

  const agencyId = req.user?.agencyId;
  if (!agencyId) { next(); return; }

  const plan     = await getAgencyPlan(agencyId);
  const features = getPlanFeatures(plan);

  if (features.maxUsers === null) { next(); return; } // unlimited

  const count = await prisma.user.count({
    where: { agencyId, isActive: true, role: { not: Role.SUPER_ADMIN } },
  });

  if (count >= features.maxUsers) {
    throw ApiError.forbidden(
      `Limite d'utilisateurs atteinte (${features.maxUsers} max pour le plan ${plan.toUpperCase()}). ` +
      `Passez à un plan supérieur pour ajouter plus d'utilisateurs.`
    );
  }

  next();
}
