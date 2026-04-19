import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { parsePaginationParams, buildPaginationMeta } from '../../utils/ApiResponse';
import { CarStatus, Prisma } from '@prisma/client';
import { CreateCarDto, UpdateCarDto } from './cars.schema';

export const CarsService = {
  async findAll(agencyId: string, query: Record<string, unknown>) {
    const { page, limit, skip } = parsePaginationParams(query);

    const where: Prisma.CarWhereInput = {
      agencyId,
      isActive: true,
    };

    if (query.status) where.status = query.status as CarStatus;
    if (query.brand) where.brand = { contains: String(query.brand), mode: 'insensitive' };
    if (query.fuelType) where.fuelType = query.fuelType as any;
    if (query.transmission) where.transmission = query.transmission as any;
    if (query.minPrice || query.maxPrice) {
      where.pricePerDay = {
        ...(query.minPrice && { gte: Number(query.minPrice) }),
        ...(query.maxPrice && { lte: Number(query.maxPrice) }),
      };
    }
    if (query.search) {
      const search = String(query.search);
      where.OR = [
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { licensePlate: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [cars, total] = await Promise.all([
      prisma.car.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reservations: {
            where: { status: { in: ['ACTIVE', 'CONFIRMED', 'PENDING'] } },
            select: {
              id: true,
              startDate: true,
              endDate: true,
              status: true,
              reservationNumber: true,
              client: { select: { firstName: true, lastName: true, phone: true } },
            },
            orderBy: { startDate: 'asc' },
            take: 1,
          },
        },
      }),
      prisma.car.count({ where }),
    ]);

    return { cars, meta: buildPaginationMeta(total, page, limit) };
  },

  async findById(agencyId: string, carId: string) {
    const car = await prisma.car.findFirst({
      where: { id: carId, agencyId, isActive: true },
      include: {
        reservations: {
          where: { status: { in: ['CONFIRMED', 'ACTIVE'] } },
          select: { startDate: true, endDate: true, status: true },
          orderBy: { startDate: 'asc' },
        },
        _count: { select: { reservations: true } },
      },
    });

    if (!car) throw ApiError.notFound('Véhicule introuvable');
    return car;
  },

  async create(agencyId: string, dto: CreateCarDto) {
    // Check license plate uniqueness within this agency only
    const existing = await prisma.car.findFirst({
      where: { licensePlate: dto.licensePlate, agencyId, isActive: true },
    });
    if (existing) throw ApiError.conflict('Ce numéro d\'immatriculation existe déjà');

    return prisma.car.create({
      data: {
        ...dto,
        agencyId,
        deposit:         dto.deposit         ?? 0,
        lastMaintenance: dto.lastMaintenance ? new Date(dto.lastMaintenance) : null,
        nextMaintenance: dto.nextMaintenance ? new Date(dto.nextMaintenance) : null,
        insuranceExpiry: dto.insuranceExpiry ? new Date(dto.insuranceExpiry) : null,
        technicalExpiry: dto.technicalExpiry ? new Date(dto.technicalExpiry) : null,
      } as any,
    });
  },

  async update(agencyId: string, carId: string, dto: UpdateCarDto) {
    const car = await CarsService.findById(agencyId, carId);

    if (dto.licensePlate) {
      const existing = await prisma.car.findFirst({
        where: { licensePlate: dto.licensePlate, agencyId, id: { not: carId } },
      });
      if (existing) throw ApiError.conflict('Ce numéro d\'immatriculation existe déjà');
    }

    const updated = await prisma.car.update({
      where: { id: carId },
      data: {
        ...dto,
        lastMaintenance:    dto.lastMaintenance    ? new Date(dto.lastMaintenance)    : undefined,
        nextMaintenance:    dto.nextMaintenance    ? new Date(dto.nextMaintenance)    : undefined,
        insuranceExpiry:    dto.insuranceExpiry    ? new Date(dto.insuranceExpiry)    : (dto.insuranceExpiry    === null ? null : undefined),
        technicalExpiry:    dto.technicalExpiry    ? new Date(dto.technicalExpiry)    : (dto.technicalExpiry    === null ? null : undefined),
        vignetteExpiry:     (dto as any).vignetteExpiry     ? new Date((dto as any).vignetteExpiry)     : ((dto as any).vignetteExpiry     === null ? null : undefined),
        carteGriseDate:     (dto as any).carteGriseDate     ? new Date((dto as any).carteGriseDate)     : ((dto as any).carteGriseDate     === null ? null : undefined),
        autorisationExpiry: (dto as any).autorisationExpiry ? new Date((dto as any).autorisationExpiry) : ((dto as any).autorisationExpiry === null ? null : undefined),
      },
    });

    // Auto-create a PENDING maintenance task when car is set to MAINTENANCE
    if (dto.status === 'MAINTENANCE' && car.status !== 'MAINTENANCE') {
      prisma.maintenance.create({
        data: {
          agencyId,
          carId,
          type:   'REPARATION' as any,
          date:   new Date(),
          status: 'PENDING' as any,
          notes:  'Mise en maintenance depuis la liste des véhicules',
        },
      }).catch(() => {});
    }

    return updated;
  },

  async delete(agencyId: string, carId: string) {
    const car = await CarsService.findById(agencyId, carId);

    // Check for active reservations
    const activeReservation = await prisma.reservation.findFirst({
      where: { carId, status: { in: ['ACTIVE', 'CONFIRMED'] } },
    });
    if (activeReservation) {
      throw ApiError.conflict('Impossible de supprimer un véhicule avec des réservations actives');
    }

    // Soft delete — free up the license plate by renaming it
    await prisma.car.update({
      where: { id: carId },
      data: { isActive: false, licensePlate: `DELETED_${Date.now()}_${car.licensePlate}` },
    });

    return car;
  },

  async checkAvailability(agencyId: string, carId: string, startDate: Date, endDate: Date, excludeReservationId?: string) {
    const conflict = await prisma.reservation.findFirst({
      where: {
        carId,
        agencyId,
        status: { in: ['CONFIRMED', 'ACTIVE', 'PENDING'] },
        ...(excludeReservationId && { id: { not: excludeReservationId } }),
        AND: [
          { startDate: { lt: endDate } },
          { endDate: { gt: startDate } },
        ],
      },
    });
    return { available: !conflict, conflict };
  },

  async getStats(agencyId: string) {
    const [total, byStatus] = await Promise.all([
      prisma.car.count({ where: { agencyId, isActive: true } }),
      prisma.car.groupBy({
        by: ['status'],
        where: { agencyId, isActive: true },
        _count: true,
      }),
    ]);

    const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));

    return {
      total,
      available: statusMap[CarStatus.AVAILABLE] ?? 0,
      rented: statusMap[CarStatus.RENTED] ?? 0,
      maintenance: statusMap[CarStatus.MAINTENANCE] ?? 0,
      outOfService: statusMap[CarStatus.OUT_OF_SERVICE] ?? 0,
      utilizationRate: total > 0 ? Math.round(((statusMap[CarStatus.RENTED] ?? 0) / total) * 100) : 0,
    };
  },
};
