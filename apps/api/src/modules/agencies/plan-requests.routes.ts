import { Router } from 'express';
import { prisma } from '../../config/database';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { z } from 'zod';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);

const requestSchema = z.object({
  requestedPlan: z.enum(['pro', 'enterprise']),
  message:       z.string().max(500).optional(),
});

// ── Agency: send an upgrade request ──────────────────────────────────
router.post('/', async (req, res) => {
  const agencyId = req.user?.agencyId;
  if (!agencyId) throw ApiError.forbidden('Action réservée aux agences');

  const { requestedPlan, message } = requestSchema.parse(req.body);

  // Check if there's already a pending request for this agency
  const existing = await prisma.planUpgradeRequest.findFirst({
    where: { agencyId, status: 'pending' },
  });
  if (existing) {
    throw ApiError.conflict('Vous avez déjà une demande de mise à niveau en attente');
  }

  const request = await prisma.planUpgradeRequest.create({
    data: { agencyId, requestedPlan, message },
    include: { agency: { select: { name: true, plan: true } } },
  });

  ApiResponse.created(res, request, 'Demande de mise à niveau envoyée');
});

// ── Agency: get own request status ───────────────────────────────────
router.get('/my', async (req, res) => {
  const agencyId = req.user?.agencyId;
  if (!agencyId) throw ApiError.forbidden();

  const request = await prisma.planUpgradeRequest.findFirst({
    where: { agencyId },
    orderBy: { createdAt: 'desc' },
  });

  ApiResponse.success(res, request);
});

// ── Super Admin: list all upgrade requests ────────────────────────────
router.get('/', authorize(Role.SUPER_ADMIN), async (_req, res) => {
  const requests = await prisma.planUpgradeRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      agency: { select: { id: true, name: true, plan: true, email: true } },
    },
  });
  ApiResponse.success(res, requests);
});

// ── Super Admin: pending count ────────────────────────────────────────
router.get('/pending-count', authorize(Role.SUPER_ADMIN), async (_req, res) => {
  const count = await prisma.planUpgradeRequest.count({ where: { status: 'pending' } });
  ApiResponse.success(res, { count });
});

// ── Super Admin: approve ──────────────────────────────────────────────
router.patch('/:id/approve', authorize(Role.SUPER_ADMIN), async (req, res) => {
  const request = await prisma.planUpgradeRequest.findUnique({
    where: { id: req.params.id },
    include: { agency: true },
  });
  if (!request) throw ApiError.notFound('Demande introuvable');
  if (request.status !== 'pending') throw ApiError.badRequest('Cette demande a déjà été traitée');

  await prisma.$transaction([
    prisma.planUpgradeRequest.update({
      where: { id: request.id },
      data: { status: 'approved' },
    }),
    prisma.agency.update({
      where: { id: request.agencyId },
      data: { plan: request.requestedPlan },
    }),
  ]);

  ApiResponse.success(res, null, `Plan mis à jour → ${request.requestedPlan}`);
});

// ── Super Admin: reject ───────────────────────────────────────────────
router.patch('/:id/reject', authorize(Role.SUPER_ADMIN), async (req, res) => {
  const request = await prisma.planUpgradeRequest.findUnique({
    where: { id: req.params.id },
  });
  if (!request) throw ApiError.notFound('Demande introuvable');
  if (request.status !== 'pending') throw ApiError.badRequest('Cette demande a déjà été traitée');

  await prisma.planUpgradeRequest.update({
    where: { id: request.id },
    data: { status: 'rejected' },
  });

  ApiResponse.success(res, null, 'Demande refusée');
});

export default router;
