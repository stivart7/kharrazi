import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { parsePaginationParams, buildPaginationMeta } from '../../utils/ApiResponse';
import { PaymentStatus, PaymentType, Prisma } from '@prisma/client';
import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';
import { WhatsappService } from '../../services/whatsapp.service';

export const createPaymentSchema = z.object({
  reservationId: z.string().min(1),
  amount: z.number().positive(),
  type: z.nativeEnum(PaymentType),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  notes: z.string().optional(),
  paidAt: z.string().datetime().optional(),
});

export type CreatePaymentDto = z.infer<typeof createPaymentSchema>;

export const PaymentsService = {
  async findAll(agencyId: string, query: Record<string, unknown>) {
    const { page, limit, skip } = parsePaginationParams(query);

    const where: Prisma.PaymentWhereInput = { agencyId };

    if (query.status) where.status = query.status as PaymentStatus;
    if (query.type) where.type = query.type as PaymentType;
    if (query.reservationId) where.reservationId = String(query.reservationId);
    if (query.from) where.createdAt = { gte: new Date(String(query.from)) };
    if (query.to) where.createdAt = { ...where.createdAt as any, lte: new Date(String(query.to)) };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reservation: {
            select: {
              reservationNumber: true,
              car: { select: { brand: true, model: true, licensePlate: true } },
              client: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return { payments, meta: buildPaginationMeta(total, page, limit) };
  },

  async create(agencyId: string, dto: CreatePaymentDto) {
    const reservation = await prisma.reservation.findFirst({
      where: { id: dto.reservationId, agencyId },
    });
    if (!reservation) throw ApiError.notFound('Réservation introuvable');

    const payment = await prisma.payment.create({
      data: {
        agencyId,
        reservationId: dto.reservationId,
        amount: dto.amount,
        type: dto.type,
        method: dto.method,
        status: PaymentStatus.PAID,
        reference: dto.reference,
        notes: dto.notes,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
      },
      include: {
        reservation: {
          include: { client: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    // WhatsApp notification (fire & forget)
    WhatsappService.notifyPayment(agencyId, {
      paymentId:  payment.id,
      clientName: `${payment.reservation.client.firstName} ${payment.reservation.client.lastName}`,
      amount:     Number(payment.amount),
      method:     payment.method,
    }).catch(() => {});

    return payment;
  },

  async getFinancialSummary(agencyId: string, period: 'week' | 'month' | 'year' = 'month') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case 'year': startDate = new Date(now.getFullYear(), 0, 1); break;
      default: startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const [payments, totalRevenue, pendingAmount] = await Promise.all([
      prisma.payment.groupBy({
        by: ['type'],
        where: { agencyId, status: PaymentStatus.PAID, createdAt: { gte: startDate } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: {
          agencyId,
          status: PaymentStatus.PAID,
          type: { in: [PaymentType.RENTAL, PaymentType.EXTRA] },
          createdAt: { gte: startDate },
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { agencyId, status: PaymentStatus.PENDING },
        _sum: { amount: true },
      }),
    ]);

    return {
      period,
      totalRevenue: Number(totalRevenue._sum.amount ?? 0),
      pendingAmount: Number(pendingAmount._sum.amount ?? 0),
      byType: Object.fromEntries(
        payments.map((p) => [p.type, { total: Number(p._sum.amount ?? 0), count: p._count }])
      ),
    };
  },

  async getMonthlyRevenue(agencyId: string, year: number) {
    const results = await prisma.$queryRaw<{ month: number; revenue: number }[]>`
      SELECT
        EXTRACT(MONTH FROM p."createdAt")::int AS month,
        SUM(p.amount)::float AS revenue
      FROM payments p
      WHERE p."agencyId" = ${agencyId}
        AND p.status = 'PAID'
        AND p.type IN ('RENTAL', 'EXTRA')
        AND EXTRACT(YEAR FROM p."createdAt") = ${year}
      GROUP BY month
      ORDER BY month
    `;

    // Fill missing months with 0
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      revenue: results.find((r) => r.month === i + 1)?.revenue ?? 0,
    }));

    return monthlyData;
  },

  async remove(agencyId: string, paymentId: string) {
    const payment = await prisma.payment.findFirst({ where: { id: paymentId, agencyId } });
    if (!payment) throw ApiError.notFound('Paiement introuvable');
    await prisma.payment.delete({ where: { id: paymentId } });
  },
};
