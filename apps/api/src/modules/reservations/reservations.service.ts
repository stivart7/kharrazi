import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { parsePaginationParams, buildPaginationMeta } from '../../utils/ApiResponse';
import { Prisma, ReservationStatus, CarStatus } from '@prisma/client';
import { CreateReservationDto, UpdateReservationDto, CompleteReservationDto } from './reservations.schema';
import { WhatsappService } from '../../services/whatsapp.service';

function generateReservationNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(10000 + Math.random() * 90000);
  return `REF-${year}-${random}`;
}

function calcDays(start: Date, end: Date): number {
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export const ReservationsService = {
  async findAll(agencyId: string, query: Record<string, unknown>) {
    const { page, limit, skip } = parsePaginationParams(query);

    const where: Prisma.ReservationWhereInput = { agencyId };

    // Filter by type: isContract=true → contrats, isContract=false → réservations
    if (query.isContract !== undefined) {
      (where as any).isContract = query.isContract === 'true' || query.isContract === true;
    }

    if (query.status) where.status = query.status as ReservationStatus;
    if (query.clientId) where.clientId = String(query.clientId);
    if (query.carId) where.carId = String(query.carId);
    if (query.from) where.startDate = { gte: new Date(String(query.from)) };
    if (query.to) where.endDate = { lte: new Date(String(query.to)) };
    if (query.search) {
      const s = String(query.search);
      where.OR = [
        { reservationNumber: { contains: s, mode: 'insensitive' } },
        { client: { firstName: { contains: s, mode: 'insensitive' } } },
        { client: { lastName: { contains: s, mode: 'insensitive' } } },
        { client: { cin: { contains: s, mode: 'insensitive' } } },
        { car: { licensePlate: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          car: { select: { brand: true, model: true, licensePlate: true, color: true } },
          client: { select: { firstName: true, lastName: true, cin: true, phone: true } },
          payments: { select: { amount: true, type: true, status: true } },
        },
      }),
      prisma.reservation.count({ where }),
    ]);

    return { reservations, meta: buildPaginationMeta(total, page, limit) };
  },

  async findById(agencyId: string, id: string) {
    const reservation = await prisma.reservation.findFirst({
      where: { id, agencyId },
      include: {
        car: true,
        client: true,
        payments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!reservation) throw ApiError.notFound('Réservation introuvable');
    return reservation;
  },

  async create(agencyId: string, dto: CreateReservationDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    // Check car exists
    const car = await prisma.car.findFirst({
      where: { id: dto.carId, agencyId },
    });
    if (!car) throw ApiError.notFound('Véhicule introuvable');
    if (car.status === CarStatus.MAINTENANCE || car.status === CarStatus.OUT_OF_SERVICE) {
      throw ApiError.badRequest('Ce véhicule n\'est pas disponible');
    }

    // Check client exists
    const client = await prisma.client.findFirst({
      where: { id: dto.clientId, agencyId, isActive: true },
    });
    if (!client) throw ApiError.notFound('Client introuvable');
    if (client.blacklisted) throw ApiError.forbidden('Ce client est sur liste noire');

    // Check availability
    const conflict = await prisma.reservation.findFirst({
      where: {
        carId: dto.carId,
        status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.ACTIVE, ReservationStatus.PENDING] },
        AND: [{ startDate: { lt: endDate } }, { endDate: { gt: startDate } }],
      },
    });
    if (conflict) throw ApiError.conflict('Ce véhicule est déjà réservé pour cette période');

    const totalDays = calcDays(startDate, endDate);
    const pricePerDay = Number(car.pricePerDay);
    const subtotal = pricePerDay * totalDays;
    const discountPercent = dto.discountPercent ?? 0;
    const discountAmount = (subtotal * discountPercent) / 100;
    const totalAmount = subtotal - discountAmount;
    const depositAmount = Number(car.deposit);

    const initialStatus = dto.status ?? ReservationStatus.PENDING;

    const reservation = await prisma.reservation.create({
      data: {
        reservationNumber: generateReservationNumber(),
        agencyId,
        carId: dto.carId,
        clientId: dto.clientId,
        startDate,
        endDate,
        pickupLocation: dto.pickupLocation,
        returnLocation: dto.returnLocation,
        totalDays,
        pricePerDay,
        subtotal,
        discountPercent,
        discountAmount,
        totalAmount,
        depositAmount,
        status: initialStatus,
        isContract: dto.isContract ?? false,
        secondDriverFirstName: dto.secondDriverFirstName,
        secondDriverLastName:  dto.secondDriverLastName,
        secondDriverCin:       dto.secondDriverCin,
        secondDriverPhone:     dto.secondDriverPhone,
        notes: dto.notes,
      } as any,
      include: {
        car: { select: { brand: true, model: true, licensePlate: true } },
        client: { select: { firstName: true, lastName: true, cin: true } },
      },
    });

    // If amountPaid provided, create a payment record
    const amountPaid = dto.amountPaid ?? 0;
    if (amountPaid > 0) {
      await prisma.payment.create({
        data: {
          agencyId,
          reservationId: reservation.id,
          amount:        amountPaid,
          type:          'RENTAL',
          method:        (dto.paymentMethod as any) ?? 'CASH',
          status:        'PAID',
          paidAt:        new Date(),
        },
      });
    }

    // WhatsApp notification (fire & forget)
    WhatsappService.notifyNewReservation(agencyId, {
      reservationId: reservation.id,
      clientName: `${reservation.client.firstName} ${reservation.client.lastName}`,
      carBrand: reservation.car.brand,
      carModel: reservation.car.model,
      startDate: startDate.toLocaleDateString('fr-MA'),
      endDate: endDate.toLocaleDateString('fr-MA'),
    }).catch(() => {});

    return reservation;
  },

  async update(agencyId: string, id: string, dto: Partial<{
    startDate: string; endDate: string;
    pickupLocation: string; returnLocation: string;
    discountPercent: number; notes: string;
  }>) {
    const reservation = await ReservationsService.findById(agencyId, id);
    if ([ReservationStatus.COMPLETED, ReservationStatus.CANCELLED].includes(reservation.status as any)) {
      throw ApiError.badRequest('Impossible de modifier une réservation terminée ou annulée');
    }

    const data: any = {};
    if (dto.startDate)       data.startDate      = new Date(dto.startDate);
    if (dto.endDate)         data.endDate        = new Date(dto.endDate);
    if (dto.pickupLocation !== undefined) data.pickupLocation = dto.pickupLocation;
    if (dto.returnLocation !== undefined) data.returnLocation = dto.returnLocation;
    if (dto.notes      !== undefined) data.notes      = dto.notes;
    if (dto.discountPercent !== undefined) {
      data.discountPercent = dto.discountPercent;
      const start = data.startDate ?? reservation.startDate;
      const end   = data.endDate   ?? reservation.endDate;
      const days  = calcDays(new Date(start), new Date(end));
      const price = Number(reservation.pricePerDay);
      const subtotal = price * days;
      data.totalDays     = days;
      data.subtotal      = subtotal;
      data.discountAmount = (subtotal * dto.discountPercent) / 100;
      data.totalAmount   = subtotal - data.discountAmount;
    }

    return prisma.reservation.update({ where: { id }, data });
  },

  async confirm(agencyId: string, id: string) {
    const reservation = await ReservationsService.findById(agencyId, id);
    if (reservation.status !== ReservationStatus.PENDING) {
      throw ApiError.badRequest('Seules les réservations en attente peuvent être confirmées');
    }
    return prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.CONFIRMED },
    });
  },

  async activate(agencyId: string, id: string, startMileage?: number) {
    const reservation = await ReservationsService.findById(agencyId, id);
    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw ApiError.badRequest('Seules les réservations confirmées peuvent être activées');
    }

    // Check if a RENTAL payment already exists to avoid duplicates
    const existingPayment = await prisma.payment.findFirst({
      where: { reservationId: id, type: 'RENTAL', status: 'PAID' },
    });

    const ops: any[] = [
      prisma.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.ACTIVE,
          startMileage,
          fuelLevelStart: 'full',
        },
      }),
      prisma.car.update({
        where: { id: reservation.carId },
        data: { status: CarStatus.RENTED },
      }),
    ];

    // Auto-create PAID invoice for contracts that don't already have a payment
    if ((reservation as any).isContract && !existingPayment) {
      ops.push(
        prisma.payment.create({
          data: {
            agencyId,
            reservationId: id,
            amount: (reservation as any).totalAmount,
            type: 'RENTAL',
            method: 'CASH',
            status: 'PAID',
            paidAt: new Date(),
          },
        })
      );
    }

    await prisma.$transaction(ops);

    return ReservationsService.findById(agencyId, id);
  },

  async complete(agencyId: string, id: string, dto: CompleteReservationDto) {
    const reservation = await ReservationsService.findById(agencyId, id);
    if (reservation.status !== ReservationStatus.ACTIVE) {
      throw ApiError.badRequest('Seules les réservations actives peuvent être clôturées');
    }

    await prisma.$transaction([
      prisma.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.COMPLETED,
          actualReturnDate: new Date(dto.actualReturnDate),
          endMileage: dto.endMileage,
          fuelLevelEnd: dto.fuelLevelEnd,
          extraCharges: dto.extraCharges ?? 0,
          notes: dto.notes,
        },
      }),
      prisma.car.update({
        where: { id: reservation.carId },
        data: {
          status: CarStatus.AVAILABLE,
          mileage: dto.endMileage ?? undefined,
        },
      }),
      // Update client stats
      prisma.client.update({
        where: { id: reservation.clientId },
        data: {
          totalRentals: { increment: 1 },
          totalSpent: { increment: Number(reservation.totalAmount) },
        },
      }),
    ]);

    const completed = await ReservationsService.findById(agencyId, id);

    // Auto-create post-rental CHECK task (fire & forget)
    prisma.maintenance.create({
      data: {
        agencyId,
        carId:  reservation.carId,
        type:   'CHECK' as any,
        date:   new Date(),
        status: 'PENDING' as any,
        notes:  'Inspection post-location',
      },
    }).catch(() => {});

    // WhatsApp notification (fire & forget)
    WhatsappService.notifyReturn(agencyId, {
      reservationId: id,
      carBrand: (completed as any).car?.brand ?? '',
      carModel: (completed as any).car?.model ?? '',
      clientName: `${(completed as any).client?.firstName ?? ''} ${(completed as any).client?.lastName ?? ''}`,
    }).catch(() => {});

    return completed;
  },

  async cancel(agencyId: string, id: string, reason?: string) {
    const reservation = await ReservationsService.findById(agencyId, id);
    if (([ReservationStatus.COMPLETED, ReservationStatus.CANCELLED] as string[]).includes(reservation.status)) {
      throw ApiError.badRequest('Cette réservation ne peut pas être annulée');
    }

    const updates: Prisma.ReservationUpdateInput = {
      status: ReservationStatus.CANCELLED,
      notes: reason ? `Annulée: ${reason}` : reservation.notes,
    };

    // If car was rented, make it available again
    const needsCarUpdate = reservation.status === ReservationStatus.ACTIVE;

    await prisma.$transaction([
      prisma.reservation.update({ where: { id }, data: updates }),
      ...(needsCarUpdate
        ? [prisma.car.update({ where: { id: reservation.carId }, data: { status: CarStatus.AVAILABLE } })]
        : []),
    ]);

    return ReservationsService.findById(agencyId, id);
  },

  async getStats(agencyId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, active, thisMonth, byStatus] = await Promise.all([
      prisma.reservation.count({ where: { agencyId, isContract: false } as any }),
      prisma.reservation.count({ where: { agencyId, status: ReservationStatus.ACTIVE, isContract: false } as any }),
      prisma.reservation.count({ where: { agencyId, createdAt: { gte: startOfMonth }, isContract: false } as any }),
      prisma.reservation.groupBy({
        by: ['status'],
        where: { agencyId, isContract: false } as any,
        _count: true,
      }),
    ]);

    return {
      total,
      active,
      thisMonth,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
    };
  },

  async cleanupOverdue(agencyId: string) {
    const now = new Date();

    // 1. Cars with overdue ACTIVE reservation (endDate passed)
    const overdueReservations = await prisma.reservation.findMany({
      where: {
        agencyId,
        status: ReservationStatus.ACTIVE,
        endDate: { lt: now },
      },
      select: { id: true, carId: true },
    });

    // 2. Cars stuck as RENTED with no active/confirmed/pending reservation at all
    const stuckCars = await prisma.car.findMany({
      where: {
        agencyId,
        status: CarStatus.RENTED,
        reservations: {
          none: {
            status: { in: [ReservationStatus.ACTIVE, ReservationStatus.CONFIRMED, ReservationStatus.PENDING] },
          },
        },
      },
      select: { id: true },
    });

    const overdueCarIds = overdueReservations.map((r) => r.carId);
    const stuckCarIds   = stuckCars.map((c) => c.id);
    const allCarIds     = [...new Set([...overdueCarIds, ...stuckCarIds])];

    if (allCarIds.length === 0) return { updated: 0 };

    await prisma.$transaction(
      allCarIds.map((carId) =>
        prisma.car.update({
          where: { id: carId },
          data: { status: CarStatus.AVAILABLE },
        })
      )
    );

    return { updated: allCarIds.length };
  },

  async remove(agencyId: string, reservationId: string) {
    const reservation = await prisma.reservation.findFirst({
      where: { id: reservationId, agencyId },
    });
    if (!reservation) throw ApiError.notFound('Réservation introuvable');
    if (reservation.status === ReservationStatus.ACTIVE) {
      throw ApiError.badRequest('Impossible de supprimer une réservation active');
    }
    // Delete related payments first, then reservation
    await prisma.payment.deleteMany({ where: { reservationId } });
    await prisma.reservation.delete({ where: { id: reservationId } });
  },
};
