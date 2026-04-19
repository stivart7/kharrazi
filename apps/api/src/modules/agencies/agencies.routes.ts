import { Router } from 'express';
import { prisma } from '../../config/database';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { ApiResponse, parsePaginationParams, buildPaginationMeta } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { z } from 'zod';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const router = Router();

const agencySchema = z.object({
  name:              z.string().min(2),
  email:             z.string().email(),
  phone:             z.string().optional(),
  address:           z.string().optional(),
  city:              z.string().optional(),
  plan:              z.enum(['basic', 'pro', 'enterprise']).default('basic'),
  monthlyFee:        z.coerce.number().min(0).optional(),
  subscriptionEnd:   z.string().optional().nullable(),
});

router.use(authenticate);
router.use(authorize(Role.SUPER_ADMIN));

router.get('/', async (req, res) => {
  const { page, limit, skip } = parsePaginationParams(req.query as any);
  const [agencies, total] = await Promise.all([
    prisma.agency.findMany({
      skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { users: true, cars: true, clients: true, reservations: true } },
      },
    }),
    prisma.agency.count(),
  ]);
  ApiResponse.paginated(res, agencies, buildPaginationMeta(total, page, limit));
});

router.get('/:id', async (req, res) => {
  const agency = await prisma.agency.findUnique({
    where: { id: req.params.id },
    include: {
      users: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      _count: { select: { cars: true, clients: true, reservations: true } },
    },
  });
  if (!agency) throw ApiError.notFound('Agence introuvable');
  ApiResponse.success(res, agency);
});

router.post('/', async (req, res) => {
  const dto = agencySchema.parse(req.body);
  const existing = await prisma.agency.findUnique({ where: { email: dto.email } });
  if (existing) throw ApiError.conflict('Une agence avec cet email existe déjà');
  const agency = await prisma.agency.create({ data: dto as any });
  ApiResponse.created(res, agency, 'Agence créée');
});

router.patch('/:id', async (req, res) => {
  const dto = agencySchema.partial().parse(req.body);
  const data: any = { ...dto };
  // Convert date string "YYYY-MM-DD" to full ISO DateTime for Prisma
  if (data.subscriptionEnd && typeof data.subscriptionEnd === 'string') {
    data.subscriptionEnd = new Date(data.subscriptionEnd + 'T00:00:00.000Z');
  }
  if (data.subscriptionEnd === null || data.subscriptionEnd === '') {
    data.subscriptionEnd = null;
  }
  const agency = await prisma.agency.update({ where: { id: req.params.id }, data });
  ApiResponse.success(res, agency, 'Agence mise à jour');
});

// Onboard: create agency + admin user in one step
const onboardSchema = z.object({
  agency: agencySchema,
  admin: z.object({
    firstName: z.string().min(2),
    lastName:  z.string().min(2),
    email:     z.string().email(),
    password:  z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
    phone:     z.string().optional(),
  }),
});

router.post('/onboard', async (req, res) => {
  const { agency: agencyDto, admin: adminDto } = onboardSchema.parse(req.body);

  const existingAgency = await prisma.agency.findUnique({ where: { email: agencyDto.email } });
  if (existingAgency) throw ApiError.conflict('Une agence avec cet email existe déjà');

  const existingUser = await prisma.user.findUnique({ where: { email: adminDto.email } });
  if (existingUser) throw ApiError.conflict('Un utilisateur avec cet email existe déjà');

  const hashed = await bcrypt.hash(adminDto.password, 12);

  const agency = await prisma.agency.create({ data: agencyDto as any });
  const user = await prisma.user.create({
    data: {
      ...adminDto,
      password: hashed,
      role: Role.AGENCY_ADMIN,
      agencyId: agency.id,
    } as any,
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  });

  ApiResponse.created(res, { agency, admin: user }, 'Agence et administrateur créés avec succès');
});

router.delete('/:id', async (req, res) => {
  const agency = await prisma.agency.findUnique({ where: { id: req.params.id } });
  if (!agency) throw ApiError.notFound('Agence introuvable');
  await prisma.agency.delete({ where: { id: req.params.id } });
  ApiResponse.success(res, null, 'Agence supprimée');
});

router.patch('/:id/toggle', async (req, res) => {
  const agency = await prisma.agency.findUnique({ where: { id: req.params.id } });
  if (!agency) throw ApiError.notFound();
  const updated = await prisma.agency.update({
    where: { id: req.params.id },
    data: { isActive: !agency.isActive },
  });
  ApiResponse.success(res, updated);
});

// SaaS monthly revenue chart — last 12 months MRR
router.get('/saas/revenue-chart', async (_req, res) => {
  const now = new Date();

  const agencies = await prisma.agency.findMany({
    select: {
      createdAt:         true,
      subscriptionStart: true,
      subscriptionEnd:   true,
      monthlyFee:        true,
    },
  });

  const months = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const label      = monthStart.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });

    let mrr = 0;
    let count = 0;
    for (const agency of agencies) {
      const created  = new Date(agency.createdAt);
      const expired  = agency.subscriptionEnd ? new Date(agency.subscriptionEnd) : null;
      if (created <= monthEnd && (!expired || expired >= monthStart)) {
        mrr += Number(agency.monthlyFee ?? 0);
        count++;
      }
    }
    months.push({ month: label, mrr, count });
  }

  ApiResponse.success(res, { months });
});

// SaaS revenue dashboard — stats per agency
router.get('/saas/overview', async (_req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const agencies = await prisma.agency.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true, cars: true, clients: true, reservations: true } },
    },
  });

  // For each agency compute months active + MRR
  const result = await Promise.all(agencies.map(async (a) => {
    const start = new Date(a.subscriptionStart ?? a.createdAt);
    const monthsActive = Math.max(1,
      (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth()) + 1
    );
    const fee      = Number(a.monthlyFee ?? 0);
    const lifetime = fee * monthsActive;

    // Activity this month
    const [reservationsThisMonth, revenueThisMonth] = await Promise.all([
      prisma.reservation.count({ where: { agencyId: a.id, createdAt: { gte: startOfMonth } } }),
      prisma.payment.aggregate({
        where: { agencyId: a.id, status: 'PAID', createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
    ]);

    const expiring = a.subscriptionEnd
      ? Math.ceil((new Date(a.subscriptionEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      ...a,
      monthsActive,
      lifetimeRevenue: lifetime,
      reservationsThisMonth,
      agencyRevenueThisMonth: Number(revenueThisMonth._sum.amount ?? 0),
      daysUntilExpiry: expiring,
    };
  }));

  const totalMRR     = result.reduce((s, a) => s + Number(a.monthlyFee ?? 0), 0);
  const totalARR     = totalMRR * 12;
  const totalRevenue = result.reduce((s, a) => s + a.lifetimeRevenue, 0);
  const activeCount  = result.filter((a) => a.isActive).length;
  const expiringCount = result.filter((a) => a.daysUntilExpiry !== null && a.daysUntilExpiry <= 30 && a.daysUntilExpiry >= 0).length;

  ApiResponse.success(res, {
    summary: { totalMRR, totalARR, totalRevenue, activeCount, total: result.length, expiringCount },
    agencies: result,
  });
});

export default router;
