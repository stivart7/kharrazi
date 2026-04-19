import { prisma } from '../../config/database';
import { CarStatus, ReservationStatus, PaymentStatus, PaymentType } from '@prisma/client';

export const AnalyticsService = {
  async getDashboard(agencyId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      // Current month
      carsStats,
      activeReservations,
      thisMonthRevenue,
      thisMonthReservations,
      // Last month (for comparison)
      lastMonthRevenue,
      lastMonthReservations,
      // Top data
      recentReservations,
      topClients,
      reservationsByStatus,
      upcomingReturns,
    ] = await Promise.all([
      // Fleet overview
      prisma.car.groupBy({
        by: ['status'],
        where: { agencyId, isActive: true },
        _count: true,
      }),
      // Active rentals (contrats ACTIVE seulement)
      prisma.reservation.count({
        where: { agencyId, status: ReservationStatus.ACTIVE, isContract: true } as any,
      }),
      // This month revenue
      prisma.payment.aggregate({
        where: {
          agencyId,
          status: PaymentStatus.PAID,
          type: { in: [PaymentType.RENTAL, PaymentType.EXTRA] },
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
      // This month reservations (réservations futures seulement, pas contrats)
      prisma.reservation.count({
        where: { agencyId, createdAt: { gte: startOfMonth }, isContract: false } as any,
      }),
      // Last month revenue
      prisma.payment.aggregate({
        where: {
          agencyId,
          status: PaymentStatus.PAID,
          type: { in: [PaymentType.RENTAL, PaymentType.EXTRA] },
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { amount: true },
      }),
      // Last month reservations (réservations futures seulement)
      prisma.reservation.count({
        where: {
          agencyId,
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          isContract: false,
        } as any,
      }),
      // Recent reservations (réservations futures seulement)
      prisma.reservation.findMany({
        where: { agencyId, isContract: false } as any,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          car: { select: { brand: true, model: true, licensePlate: true } },
          client: { select: { firstName: true, lastName: true } },
        },
      }),
      // Top clients by revenue
      prisma.client.findMany({
        where: { agencyId, isActive: true },
        orderBy: { totalSpent: 'desc' },
        take: 5,
        select: { id: true, firstName: true, lastName: true, totalRentals: true, totalSpent: true, riskScore: true },
      }),
      // Reservations by status (réservations futures seulement)
      prisma.reservation.groupBy({
        by: ['status'],
        where: { agencyId, isContract: false } as any,
        _count: true,
      }),
      // Upcoming returns (contrats ACTIVE avec retour dans 3 jours)
      prisma.reservation.findMany({
        where: {
          agencyId,
          status: ReservationStatus.ACTIVE,
          isContract: true,
          endDate: {
            gte: now,
            lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
          },
        } as any,
        include: {
          car: { select: { brand: true, model: true, licensePlate: true } },
          client: { select: { firstName: true, lastName: true, phone: true } },
        },
        orderBy: { endDate: 'asc' },
      }),
    ]);

    // Fleet cards: active rentals, available cars, confirmed reservations
    const [activeRentals, availableCars, confirmedReservations] = await Promise.all([
      prisma.reservation.findMany({
        where: { agencyId, status: ReservationStatus.ACTIVE, isContract: true } as any,
        include: {
          car: { select: { id: true, brand: true, model: true, licensePlate: true, color: true } },
          client: { select: { firstName: true, lastName: true, phone: true } },
        },
        orderBy: { endDate: 'asc' },
      }),
      prisma.car.findMany({
        where: { agencyId, isActive: true, status: CarStatus.AVAILABLE },
        select: { id: true, brand: true, model: true, licensePlate: true, color: true, pricePerDay: true },
        orderBy: { brand: 'asc' },
      }),
      prisma.reservation.findMany({
        where: { agencyId, status: ReservationStatus.CONFIRMED, isContract: false } as any,
        include: {
          car: { select: { id: true, brand: true, model: true, licensePlate: true, color: true } },
          client: { select: { firstName: true, lastName: true, phone: true } },
        },
        orderBy: { startDate: 'asc' },
      }),
    ]);

    // Fleet breakdown
    const fleetMap = Object.fromEntries(carsStats.map((s) => [s.status, s._count]));
    const totalCars = Object.values(fleetMap).reduce((a, b) => a + b, 0);

    // Revenue comparison
    const currentRevenue = Number(thisMonthRevenue._sum.amount ?? 0);
    const prevRevenue = Number(lastMonthRevenue._sum.amount ?? 0);
    const revenueGrowth = prevRevenue > 0
      ? Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100)
      : 0;

    const reservationsGrowth = lastMonthReservations > 0
      ? Math.round(((thisMonthReservations - lastMonthReservations) / lastMonthReservations) * 100)
      : 0;

    return {
      kpis: {
        totalCars,
        availableCars: fleetMap[CarStatus.AVAILABLE] ?? 0,
        rentedCars: fleetMap[CarStatus.RENTED] ?? 0,
        maintenanceCars: fleetMap[CarStatus.MAINTENANCE] ?? 0,
        utilizationRate: totalCars > 0 ? Math.round(((fleetMap[CarStatus.RENTED] ?? 0) / totalCars) * 100) : 0,
        activeReservations,
        thisMonthRevenue: currentRevenue,
        revenueGrowth,
        thisMonthReservations,
        reservationsGrowth,
      },
      recentReservations,
      topClients,
      reservationsByStatus: Object.fromEntries(
        reservationsByStatus.map((s) => [s.status, s._count])
      ),
      upcomingReturns,
      fleetCards: {
        active: activeRentals,
        available: availableCars,
        confirmed: confirmedReservations,
      },
    };
  },

  async getVehiclePerformance(agencyId: string) {
    const cars = await prisma.car.findMany({
      where: { agencyId, isActive: true },
      include: {
        reservations: {
          where: { status: { in: [ReservationStatus.COMPLETED, ReservationStatus.ACTIVE] } },
          include: {
            payments: {
              where: { status: PaymentStatus.PAID, type: { in: [PaymentType.RENTAL, PaymentType.EXTRA] } },
            },
          },
        },
      },
    });

    return cars.map((car) => {
      const totalRevenue = car.reservations
        .flatMap((r) => r.payments)
        .reduce((s, p) => s + Number(p.amount), 0);
      const totalDays = car.reservations.reduce((s, r) => {
        const days = Math.ceil(
          (new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        return s + Math.max(days, 0);
      }, 0);
      return {
        id: car.id,
        brand: car.brand,
        model: car.model,
        licensePlate: car.licensePlate,
        status: car.status,
        pricePerDay: Number(car.pricePerDay),
        totalReservations: car.reservations.length,
        totalDays,
        totalRevenue,
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  },

  async getFinancialReport(agencyId: string) {
    const [paidAgg, pendingAgg, refundAgg, byMethod, byType] = await Promise.all([
      prisma.payment.aggregate({
        where: { agencyId, status: PaymentStatus.PAID },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { agencyId, status: PaymentStatus.PENDING },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { agencyId, type: PaymentType.REFUND },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.groupBy({
        by: ['method'],
        where: { agencyId, status: PaymentStatus.PAID },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.groupBy({
        by: ['type'],
        where: { agencyId, status: PaymentStatus.PAID },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      totalPaid:        Number(paidAgg._sum.amount    ?? 0),
      totalPaidCount:   paidAgg._count,
      totalPending:     Number(pendingAgg._sum.amount ?? 0),
      totalPendingCount: pendingAgg._count,
      totalRefunded:    Number(refundAgg._sum.amount  ?? 0),
      byMethod: byMethod.map((m) => ({
        method: m.method,
        amount: Number(m._sum.amount ?? 0),
        count:  m._count,
      })),
      byType: byType.map((t) => ({
        type:   t.type,
        amount: Number(t._sum.amount ?? 0),
        count:  t._count,
      })),
    };
  },

  async getClientsReport(agencyId: string) {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [total, newThisMonth, returning, top] = await Promise.all([
      prisma.client.count({ where: { agencyId, isActive: true } }),
      prisma.client.count({ where: { agencyId, createdAt: { gte: startOfMonth } } }),
      prisma.client.count({ where: { agencyId, totalRentals: { gte: 2 } } }),
      prisma.client.findMany({
        where: { agencyId, isActive: true },
        orderBy: { totalSpent: 'desc' },
        take: 10,
        select: {
          id: true, firstName: true, lastName: true,
          phone: true, city: true,
          totalRentals: true, totalSpent: true, riskScore: true,
        },
      }),
    ]);

    return {
      total,
      newThisMonth,
      returning,
      oneTime: total - returning,
      top,
    };
  },

  async getRevenueChart(agencyId: string, year: number) {
    const months = [
      'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui',
      'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
    ];

    const results = await prisma.$queryRaw<{ month: number; revenue: number; reservations: number }[]>`
      SELECT
        EXTRACT(MONTH FROM r."createdAt")::int AS month,
        COALESCE(SUM(p.amount) FILTER (WHERE p.type IN ('RENTAL', 'EXTRA') AND p.status = 'PAID'), 0)::float AS revenue,
        COUNT(DISTINCT r.id)::int AS reservations
      FROM reservations r
      LEFT JOIN payments p ON p."reservationId" = r.id
      WHERE r."agencyId" = ${agencyId}
        AND EXTRACT(YEAR FROM r."createdAt") = ${year}
      GROUP BY month
      ORDER BY month
    `;

    return months.map((label, i) => {
      const data = results.find((r) => r.month === i + 1);
      return {
        month: label,
        revenue: data?.revenue ?? 0,
        reservations: data?.reservations ?? 0,
      };
    });
  },
};
