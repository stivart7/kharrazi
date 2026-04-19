import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { getAgencyId } from '../../middleware/tenant.middleware';
import { parseAICommand } from '../../services/ai-command-parser.service';
import { generateAIResponse } from '../../services/ai-response-generator.service';
import { askClaude, ConversationMessage } from '../../services/ai-conversation.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { requireFeature } from '../../middleware/plan.middleware';
import { prisma } from '../../config/database';
import { CarStatus, ReservationStatus, PaymentStatus, PaymentType, FuelType } from '@prisma/client';

const router = Router();
router.use(authenticate);
router.use(requireFeature('ai_assistant'));

// ── Date filter helper ─────────────────────────
function buildDateFilter(period: string): { gte: Date; lte?: Date } {
  const now = new Date();
  switch (period) {
    case 'today':
      return { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
    case 'week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      return { gte: new Date(now.getFullYear(), now.getMonth(), diff) };
    }
    case 'year':
      return { gte: new Date(now.getFullYear(), 0, 1) };
    case 'month':
    default:
      return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  }
}

// ── POST /ai/command ───────────────────────────
router.post('/command', async (req, res) => {
  const { message, history } = req.body as { message?: string; history?: ConversationMessage[] };

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return ApiResponse.error(res, 400, 'Message requis');
  }

  const userRole = req.user!.role;
  const agencyId = userRole === 'SUPER_ADMIN'
    ? (req.user!.agencyId ?? null)
    : getAgencyId(req);

  // Parse the command via OpenAI or fallback
  const cmd = await parseAICommand(message.trim());
  const { action, data, lang } = cmd;

  // ── Authorization check ──────────────────────
  if ((action === 'add_car' || action === 'delete_car') &&
      userRole !== 'AGENCY_ADMIN' && userRole !== 'SUPER_ADMIN') {
    const reply = generateAIResponse('unauthorized', {}, lang);
    return ApiResponse.success(res, { reply, action: 'unauthorized' });
  }

  if (!agencyId && userRole !== 'SUPER_ADMIN') {
    const reply = generateAIResponse('unknown', {}, lang);
    return ApiResponse.success(res, { reply, action: 'unknown' });
  }

  let result: any = {};

  try {
    switch (action) {

      // ── Report ────────────────────────────────
      case 'get_report': {
        const dateFilter = buildDateFilter(data.period ?? 'month');
        const startOfLastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
        const endOfLastMonth   = new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59);

        const [carsStats, thisMonthRevenue, lastMonthRevenue, thisMonthReservations, upcomingReturns] =
          await Promise.all([
            prisma.car.groupBy({ by: ['status'], where: { agencyId: agencyId!, isActive: true }, _count: true }),
            prisma.payment.aggregate({
              where: { agencyId: agencyId!, status: PaymentStatus.PAID, createdAt: dateFilter },
              _sum: { amount: true },
            }),
            prisma.payment.aggregate({
              where: { agencyId: agencyId!, status: PaymentStatus.PAID, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
              _sum: { amount: true },
            }),
            prisma.reservation.count({ where: { agencyId: agencyId!, createdAt: dateFilter } }),
            prisma.reservation.findMany({
              where: {
                agencyId: agencyId!,
                status: ReservationStatus.ACTIVE,
                endDate: { lte: new Date(Date.now() + 72 * 60 * 60 * 1000) },
              },
              include: { car: { select: { brand: true, model: true } }, client: { select: { firstName: true } } },
              orderBy: { endDate: 'asc' },
              take: 5,
            }),
          ]);

        const statusMap: Record<string, number> = {};
        carsStats.forEach((s) => { statusMap[s.status] = s._count; });

        const totalCars        = Object.values(statusMap).reduce((a, b) => a + b, 0);
        const availableCars    = statusMap[CarStatus.AVAILABLE] ?? 0;
        const rentedCars       = statusMap[CarStatus.RENTED]    ?? 0;
        const maintenanceCars  = statusMap[CarStatus.MAINTENANCE] ?? 0;
        const utilizationRate  = totalCars > 0 ? Math.round((rentedCars / totalCars) * 100) : 0;
        const thisRev  = Number(thisMonthRevenue._sum.amount ?? 0);
        const lastRev  = Number(lastMonthRevenue._sum.amount ?? 0);
        const revenueGrowth = lastRev > 0 ? Math.round(((thisRev - lastRev) / lastRev) * 100) : 0;

        result = {
          period: data.period ?? 'month',
          kpis: { totalCars, availableCars, rentedCars, maintenanceCars, utilizationRate,
                  thisMonthRevenue: thisRev, thisMonthReservations, revenueGrowth },
          upcomingReturns,
        };
        break;
      }

      // ── Revenue ───────────────────────────────
      case 'get_revenue': {
        const dateFilter = buildDateFilter(data.period ?? 'month');

        const [paid, pending, refunded, byMethod] = await Promise.all([
          prisma.payment.aggregate({
            where: { agencyId: agencyId!, status: PaymentStatus.PAID, createdAt: dateFilter },
            _sum: { amount: true }, _count: true,
          }),
          prisma.payment.aggregate({
            where: { agencyId: agencyId!, status: PaymentStatus.PENDING, createdAt: dateFilter },
            _sum: { amount: true },
          }),
          prisma.payment.aggregate({
            where: { agencyId: agencyId!, status: PaymentStatus.REFUNDED, createdAt: dateFilter },
            _sum: { amount: true },
          }),
          prisma.payment.groupBy({
            by: ['method'],
            where: { agencyId: agencyId!, status: PaymentStatus.PAID, createdAt: dateFilter },
            _sum: { amount: true },
          }),
        ]);

        result = {
          period: data.period ?? 'month',
          totalPaid:      Number(paid._sum.amount  ?? 0),
          totalPaidCount: paid._count,
          totalPending:   Number(pending._sum.amount  ?? 0),
          totalRefunded:  Number(refunded._sum.amount ?? 0),
          byMethod: byMethod.map((m) => ({ method: m.method, amount: Number(m._sum.amount ?? 0) })),
        };
        break;
      }

      // ── Reservations ──────────────────────────
      case 'get_reservations': {
        const dateFilter = buildDateFilter(data.period ?? 'month');
        const statusFilter = data.status ? { status: data.status as ReservationStatus } : {};

        const [stats, reservations] = await Promise.all([
          prisma.reservation.groupBy({
            by: ['status'],
            where: { agencyId: agencyId!, createdAt: dateFilter, ...statusFilter },
            _count: true,
          }),
          prisma.reservation.findMany({
            where: { agencyId: agencyId!, createdAt: dateFilter, ...statusFilter },
            include: {
              car:    { select: { brand: true, model: true } },
              client: { select: { firstName: true, lastName: true } },
            },
            orderBy: { startDate: 'desc' },
            take: 10,
          }),
        ]);

        result = { period: data.period ?? 'month', stats, reservations };
        break;
      }

      // ── Cars ──────────────────────────────────
      case 'get_cars': {
        const statusFilter = data.status ? { status: data.status as CarStatus } : {};
        const query        = data.query ? String(data.query).trim() : null;

        const queryFilter = query ? {
          OR: [
            { licensePlate: { contains: query, mode: 'insensitive' as const } },
            { brand:        { contains: query, mode: 'insensitive' as const } },
            { model:        { contains: query, mode: 'insensitive' as const } },
          ],
        } : {};

        const cars = await prisma.car.findMany({
          where: { agencyId: agencyId!, isActive: true, ...statusFilter, ...queryFilter },
          orderBy: { brand: 'asc' },
          take: 20,
        });

        result = { status: data.status ?? null, query, cars };
        break;
      }

      // ── Plates only ───────────────────────────
      case 'get_plates': {
        const statusFilter = data.status ? { status: data.status as CarStatus } : {};
        const query        = data.query ? String(data.query).trim() : null;

        const queryFilter = query ? {
          OR: [
            { licensePlate: { contains: query, mode: 'insensitive' as const } },
            { brand:        { contains: query, mode: 'insensitive' as const } },
            { model:        { contains: query, mode: 'insensitive' as const } },
          ],
        } : {};

        const cars = await prisma.car.findMany({
          where: { agencyId: agencyId!, isActive: true, ...statusFilter, ...queryFilter },
          select: {
            licensePlate: true, brand: true, model: true, year: true, status: true,
          },
          orderBy: { licensePlate: 'asc' },
        });

        result = { status: data.status ?? null, query, cars };
        break;
      }

      // ── Maintenance due ───────────────────────
      case 'get_maintenance_due': {
        const daysAhead = Number(data.days ?? 30);
        const limitDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
        const now       = new Date();

        const cars = await prisma.car.findMany({
          where: {
            agencyId: agencyId!,
            isActive: true,
            OR: [
              { status: CarStatus.MAINTENANCE },
              { nextMaintenance:  { lte: limitDate } },
              { insuranceExpiry:  { gte: now, lte: limitDate } },
              { technicalExpiry:  { gte: now, lte: limitDate } },
            ],
          },
          select: {
            licensePlate: true, brand: true, model: true, year: true, status: true,
            nextMaintenance: true, insuranceExpiry: true, technicalExpiry: true,
            lastMaintenance: true,
          },
          orderBy: { nextMaintenance: 'asc' },
        });

        result = { days: daysAhead, cars };
        break;
      }

      // ── Clients ───────────────────────────────
      case 'get_clients': {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

        const [total, newThisMonth, topClients] = await Promise.all([
          prisma.client.count({ where: { agencyId: agencyId! } }),
          prisma.client.count({ where: { agencyId: agencyId!, createdAt: { gte: startOfMonth } } }),
          prisma.client.findMany({
            where: { agencyId: agencyId! },
            include: {
              _count: { select: { reservations: true } },
              reservations: {
                where: { payments: { some: { status: PaymentStatus.PAID } } },
                include: { payments: { where: { status: PaymentStatus.PAID }, select: { amount: true } } },
              },
            },
            take: 50,
          }),
        ]);

        const enriched = topClients
          .map((c) => ({
            ...c,
            totalRentals: c._count.reservations,
            totalSpent: c.reservations.reduce((sum, r) =>
              sum + r.payments.reduce((s, p) => s + Number(p.amount), 0), 0),
          }))
          .sort((a, b) => b.totalSpent - a.totalSpent)
          .slice(0, 5);

        const returning = topClients.filter((c) => c._count.reservations >= 2).length;

        result = { total, newThisMonth, returning, top: enriched };
        break;
      }

      // ── Add car ───────────────────────────────
      case 'add_car': {
        const { brand, model, year, licensePlate, pricePerDay, deposit, fuelType } = data;

        const provided = { brand, model, year, licensePlate, pricePerDay };
        const missing  = Object.entries(provided).some(([, v]) => v === undefined || v === null || v === '');

        if (missing) {
          result = { error: 'missing_fields', provided };
          break;
        }

        const car = await prisma.car.create({
          data: {
            agencyId: agencyId!,
            brand:        String(brand),
            model:        String(model),
            year:         Number(year),
            licensePlate: String(licensePlate),
            pricePerDay:  Number(pricePerDay),
            deposit:      Number(deposit ?? 0),
            fuelType:     (fuelType as FuelType) ?? FuelType.GASOLINE,
            status:       CarStatus.AVAILABLE,
            isActive:     true,
          },
        });

        result = { car };
        break;
      }

      // ── Delete car ────────────────────────────
      case 'delete_car': {
        const query = String(data.query ?? '').trim();

        const car = await prisma.car.findFirst({
          where: {
            agencyId: agencyId!,
            isActive: true,
            OR: [
              { licensePlate: { contains: query, mode: 'insensitive' } },
              { brand:        { contains: query, mode: 'insensitive' } },
              { model:        { contains: query, mode: 'insensitive' } },
            ],
          },
        });

        if (!car) {
          result = { error: 'not_found', query };
          break;
        }

        if (car.status === CarStatus.RENTED) {
          result = { error: 'car_rented', car };
          break;
        }

        await prisma.car.update({
          where: { id: car.id },
          data:  { isActive: false },
        });

        result = { car };
        break;
      }

      // ── Upcoming returns ──────────────────────
      case 'get_upcoming': {
        const days = Number(data.days ?? 3);
        const limitDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        const now = new Date();

        const reservations = await prisma.reservation.findMany({
          where: {
            agencyId: agencyId!,
            status: ReservationStatus.ACTIVE,
            endDate: { gte: now, lte: limitDate },
          },
          include: {
            car:    { select: { brand: true, model: true, licensePlate: true } },
            client: { select: { firstName: true, lastName: true, phone: true } },
          },
          orderBy: { endDate: 'asc' },
        });

        result = { days, reservations };
        break;
      }

      // ── Overdue returns ───────────────────────
      case 'get_overdue': {
        const now = new Date();

        const reservations = await prisma.reservation.findMany({
          where: {
            agencyId: agencyId!,
            status: ReservationStatus.ACTIVE,
            endDate: { lt: now },
          },
          include: {
            car:    { select: { brand: true, model: true, licensePlate: true } },
            client: { select: { firstName: true, lastName: true, phone: true } },
          },
          orderBy: { endDate: 'asc' },
        });

        result = { reservations, now };
        break;
      }

      // ── Find client ───────────────────────────
      case 'find_client': {
        const query = String(data.query ?? '').trim();
        if (!query) { result = { error: 'no_query' }; break; }

        const clients = await prisma.client.findMany({
          where: {
            agencyId: agencyId!,
            OR: [
              { firstName:  { contains: query, mode: 'insensitive' } },
              { lastName:   { contains: query, mode: 'insensitive' } },
              { phone:      { contains: query, mode: 'insensitive' } },
              { cin:        { contains: query, mode: 'insensitive' } },
              { email:      { contains: query, mode: 'insensitive' } },
            ],
          },
          include: {
            _count: { select: { reservations: true } },
          },
          take: 5,
        });

        result = { query, clients };
        break;
      }

      // ── Add client ────────────────────────────
      case 'add_client': {
        const { firstName, lastName, phone, cin, email } = data;

        const missing = ['firstName', 'lastName', 'phone', 'cin']
          .filter((f) => !data[f] || String(data[f]).trim() === '');

        if (missing.length > 0) {
          result = { error: 'missing_fields', missing, provided: data };
          break;
        }

        // Check if CIN already exists
        const existing = await prisma.client.findFirst({
          where: { agencyId: agencyId!, cin: String(cin).toUpperCase() },
        });
        if (existing) {
          result = { error: 'cin_exists', existing };
          break;
        }

        const client = await prisma.client.create({
          data: {
            agencyId: agencyId!,
            firstName: String(firstName).trim(),
            lastName:  String(lastName).trim(),
            phone:     String(phone).trim(),
            cin:       String(cin).toUpperCase().trim(),
            email:     email ? String(email).trim() : null,
          },
        });

        result = { client };
        break;
      }

      // ── Find car ──────────────────────────────
      case 'find_car': {
        const query = String(data.query ?? '').trim();
        if (!query) { result = { error: 'no_query' }; break; }

        const cars = await prisma.car.findMany({
          where: {
            agencyId: agencyId!,
            isActive: true,
            OR: [
              { licensePlate: { contains: query, mode: 'insensitive' } },
              { brand:        { contains: query, mode: 'insensitive' } },
              { model:        { contains: query, mode: 'insensitive' } },
            ],
          },
          include: {
            reservations: {
              where:   { status: ReservationStatus.ACTIVE },
              include: { client: { select: { firstName: true, lastName: true, phone: true } } },
              take: 1,
            },
          },
          take: 5,
        });

        result = { query, cars };
        break;
      }

      // ── Pending payments ──────────────────────
      case 'get_pending_payments': {
        const payments = await prisma.payment.findMany({
          where: {
            agencyId: agencyId!,
            status:   PaymentStatus.PENDING,
          },
          include: {
            reservation: {
              include: {
                client: { select: { firstName: true, lastName: true, phone: true } },
                car:    { select: { brand: true, model: true, licensePlate: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });

        const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        result = { payments, total };
        break;
      }

      // ── Stats summary ─────────────────────────
      case 'get_stats_summary': {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const now          = new Date();

        const [
          carsByStatus,
          activeReservations,
          overdueReservations,
          returnsToday,
          revenueMonth,
          pendingPayments,
          newClientsMonth,
        ] = await Promise.all([
          prisma.car.groupBy({ by: ['status'], where: { agencyId: agencyId!, isActive: true }, _count: true }),
          prisma.reservation.count({ where: { agencyId: agencyId!, status: ReservationStatus.ACTIVE } }),
          prisma.reservation.count({ where: { agencyId: agencyId!, status: ReservationStatus.ACTIVE, endDate: { lt: now } } }),
          prisma.reservation.count({ where: { agencyId: agencyId!, status: ReservationStatus.ACTIVE, endDate: { gte: startOfToday, lte: new Date(startOfToday.getTime() + 24*60*60*1000) } } }),
          prisma.payment.aggregate({ where: { agencyId: agencyId!, status: PaymentStatus.PAID, createdAt: { gte: startOfMonth } }, _sum: { amount: true } }),
          prisma.payment.aggregate({ where: { agencyId: agencyId!, status: PaymentStatus.PENDING }, _sum: { amount: true }, _count: true }),
          prisma.client.count({ where: { agencyId: agencyId!, createdAt: { gte: startOfMonth } } }),
        ]);

        const statusMap: Record<string, number> = {};
        carsByStatus.forEach((s) => { statusMap[s.status] = s._count; });

        result = {
          cars: {
            available:   statusMap['AVAILABLE']   ?? 0,
            rented:      statusMap['RENTED']       ?? 0,
            maintenance: statusMap['MAINTENANCE']  ?? 0,
            total: Object.values(statusMap).reduce((a, b) => a + b, 0),
          },
          activeReservations,
          overdueReservations,
          returnsToday,
          revenueMonth:      Number(revenueMonth._sum.amount ?? 0),
          pendingAmount:     Number(pendingPayments._sum.amount ?? 0),
          pendingCount:      pendingPayments._count,
          newClientsMonth,
        };
        break;
      }

      default: {
        // Unknown command → use Claude for free conversation
        if (process.env.GROQ_API_KEY) {
          try {
            const claudeReply = await askClaude(message.trim(), history ?? []);
            return ApiResponse.success(res, { reply: claudeReply, action: 'conversation', lang });
          } catch (err) {
            console.warn('[AI] Claude fallback failed:', (err as Error).message);
          }
        }
        // No API key or Claude failed → show suggestions
        const reply = generateAIResponse('unknown', {}, lang);
        return ApiResponse.success(res, { reply, action: 'unknown', lang });
      }
    }
  } catch (err) {
    console.error('[AI] Execution error:', err);
    result = {};
  }

  const reply = generateAIResponse(action, result, lang);
  return ApiResponse.success(res, { reply, action, lang });
});

export default router;
