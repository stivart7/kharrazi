import { prisma } from '../config/database';
import { CarStatus, ReservationStatus, PaymentStatus, PaymentType } from '@prisma/client';

export type ReportPeriod = 'today' | 'week' | 'month' | 'year';

export function buildDateRange(period: ReportPeriod): { gte: Date; lte: Date } {
  const now = new Date();
  const lte = new Date(now);

  switch (period) {
    case 'today': {
      const gte = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { gte, lte };
    }
    case 'week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const gte = new Date(now.getFullYear(), now.getMonth(), diff);
      return { gte, lte };
    }
    case 'year': {
      const gte = new Date(now.getFullYear(), 0, 1);
      return { gte, lte };
    }
    case 'month':
    default: {
      const gte = new Date(now.getFullYear(), now.getMonth(), 1);
      return { gte, lte };
    }
  }
}

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  today: "Aujourd'hui",
  week:  'Cette semaine',
  month: 'Ce mois',
  year:  'Cette année',
};

export async function fetchReportData(agencyId: string, period: ReportPeriod) {
  const dateRange = buildDateRange(period);

  const [
    agency,
    carsByStatus,
    reservations,
    payments,
    cars,
  ] = await Promise.all([
    // Agency info
    prisma.agency.findUnique({
      where: { id: agencyId },
      select: { name: true, phone: true, email: true, address: true },
    }),

    // Fleet status
    prisma.car.groupBy({
      by: ['status'],
      where: { agencyId, isActive: true },
      _count: true,
    }),

    // Reservations in period
    prisma.reservation.findMany({
      where: { agencyId, createdAt: dateRange },
      include: {
        car:    { select: { brand: true, model: true, licensePlate: true } },
        client: { select: { firstName: true, lastName: true, phone: true } },
        payments: { where: { status: PaymentStatus.PAID }, select: { amount: true, method: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Payments in period
    prisma.payment.findMany({
      where: { agencyId, createdAt: dateRange },
      include: {
        reservation: {
          include: {
            client: { select: { firstName: true, lastName: true } },
            car:    { select: { brand: true, model: true, licensePlate: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // All active cars with performance
    prisma.car.findMany({
      where: { agencyId, isActive: true },
      include: {
        reservations: {
          where: {
            status: { in: [ReservationStatus.ACTIVE, ReservationStatus.COMPLETED] },
            createdAt: dateRange,
          },
          include: {
            payments: { where: { status: PaymentStatus.PAID, type: PaymentType.RENTAL } },
          },
        },
      },
      orderBy: { brand: 'asc' },
    }),
  ]);

  // ── Computed values ──────────────────────────
  const statusMap: Record<string, number> = {};
  carsByStatus.forEach((s) => { statusMap[s.status] = s._count; });

  const totalCars       = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const availableCars   = statusMap[CarStatus.AVAILABLE]   ?? 0;
  const rentedCars      = statusMap[CarStatus.RENTED]      ?? 0;
  const maintenanceCars = statusMap[CarStatus.MAINTENANCE] ?? 0;
  const occupancyRate   = totalCars > 0 ? Math.round((rentedCars / totalCars) * 100) : 0;

  const paidPayments    = payments.filter((p) => p.status === PaymentStatus.PAID);
  const pendingPayments = payments.filter((p) => p.status === PaymentStatus.PENDING);
  const totalRevenue    = paidPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalPending    = pendingPayments.reduce((s, p) => s + Number(p.amount), 0);

  const resByStatus = {
    PENDING:   reservations.filter((r) => r.status === ReservationStatus.PENDING).length,
    ACTIVE:    reservations.filter((r) => r.status === ReservationStatus.ACTIVE).length,
    COMPLETED: reservations.filter((r) => r.status === ReservationStatus.COMPLETED).length,
    CANCELLED: reservations.filter((r) => r.status === ReservationStatus.CANCELLED).length,
  };

  const carPerformance = cars.map((c) => {
    const totalDays = c.reservations.reduce((s, r) => {
      const days = Math.max(1, Math.ceil((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86400000));
      return s + days;
    }, 0);
    const carRevenue = c.reservations.reduce((s, r) =>
      s + r.payments.reduce((ps, p) => ps + Number(p.amount), 0), 0);
    return {
      brand: c.brand, model: c.model, licensePlate: c.licensePlate,
      status: c.status, totalReservations: c.reservations.length,
      totalDays, totalRevenue: carRevenue,
      pricePerDay: Number(c.pricePerDay),
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);

  return {
    agency,
    period,
    dateRange,
    overview: { totalCars, availableCars, rentedCars, maintenanceCars, occupancyRate },
    revenue:  { totalRevenue, totalPending, paidCount: paidPayments.length },
    reservations: { total: reservations.length, byStatus: resByStatus, list: reservations },
    payments:     { list: payments },
    carPerformance,
  };
}
