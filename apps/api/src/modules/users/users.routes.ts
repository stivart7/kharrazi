import { Router } from 'express';
import { prisma } from '../../config/database';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { getAgencyId } from '../../middleware/tenant.middleware';
import { checkUserLimit } from '../../middleware/plan.middleware';
import { z } from 'zod';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const router = Router();

const createUserSchema = z.object({
  firstName: z.string().min(2),
  lastName:  z.string().min(2),
  email:     z.string().email(),
  password:  z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  role:      z.enum(['AGENCY_ADMIN', 'EMPLOYEE', 'ACCOUNTANT']),
  phone:     z.string().optional(),
});

const updateUserSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName:  z.string().min(2).optional(),
  role:      z.enum(['AGENCY_ADMIN', 'EMPLOYEE', 'ACCOUNTANT']).optional(),
  phone:     z.string().optional(),
  isActive:  z.boolean().optional(),
});

router.use(authenticate);
router.use(authorize(Role.SUPER_ADMIN, Role.AGENCY_ADMIN));

// List users of the agency
router.get('/', async (req, res) => {
  const agencyId = getAgencyId(req);
  const currentUserId = req.user!.sub;

  const users = await prisma.user.findMany({
    where: {
      role: { not: Role.SUPER_ADMIN },
      OR: [
        { agencyId },
        { id: currentUserId }, // Always include current user even if agencyId mismatch
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, firstName: true, lastName: true, email: true,
      role: true, phone: true, isActive: true, lastLoginAt: true, createdAt: true,
    },
  });
  ApiResponse.success(res, users);
});

// Create user (plan limit enforced)
router.post('/', checkUserLimit, async (req, res) => {
  const agencyId = getAgencyId(req);
  const dto = createUserSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existing) throw ApiError.conflict('Un compte avec cet email existe déjà');

  const hashed = await bcrypt.hash(dto.password, 12);
  const user = await prisma.user.create({
    data: {
      ...dto,
      password: hashed,
      agencyId,
    } as any,
    select: {
      id: true, firstName: true, lastName: true, email: true,
      role: true, phone: true, isActive: true, createdAt: true,
    },
  });
  ApiResponse.created(res, user, 'Utilisateur créé avec succès');
});

// Update user
router.patch('/:id', async (req, res) => {
  const agencyId = getAgencyId(req);
  const dto = updateUserSchema.parse(req.body);

  const user = await prisma.user.findFirst({ where: { id: req.params.id, agencyId } });
  if (!user) throw ApiError.notFound('Utilisateur introuvable');

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: dto,
    select: {
      id: true, firstName: true, lastName: true, email: true,
      role: true, phone: true, isActive: true, createdAt: true,
    },
  });
  ApiResponse.success(res, updated, 'Utilisateur mis à jour');
});

// Toggle active
router.patch('/:id/toggle', async (req, res) => {
  const agencyId = getAgencyId(req);
  const user = await prisma.user.findFirst({ where: { id: req.params.id, agencyId } });
  if (!user) throw ApiError.notFound('Utilisateur introuvable');

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { isActive: !user.isActive },
    select: { id: true, isActive: true },
  });
  ApiResponse.success(res, updated, updated.isActive ? 'Compte activé' : 'Compte désactivé');
});

// Delete user
router.delete('/:id', async (req, res) => {
  const agencyId = getAgencyId(req);
  const user = await prisma.user.findFirst({ where: { id: req.params.id, agencyId } });
  if (!user) throw ApiError.notFound('Utilisateur introuvable');
  if (user.role === Role.SUPER_ADMIN) throw ApiError.forbidden('Impossible de supprimer ce compte');

  await prisma.user.delete({ where: { id: req.params.id } });
  ApiResponse.success(res, null, 'Utilisateur supprimé');
});

export default router;
