import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { parsePaginationParams, buildPaginationMeta } from '../../utils/ApiResponse';
import { CarStatus, Prisma } from '@prisma/client';
import { CreateClientDto, UpdateClientDto } from './clients.schema';

// ── Helper: assign or unassign a car to a client ───────────────────
async function handleCarAssignment(
  agencyId: string,
  newCarId: string | null | undefined,
  oldCarId?: string | null,
) {
  // Unassign old car → back to AVAILABLE (only if no active reservation)
  if (oldCarId && oldCarId !== newCarId) {
    const activeRes = await prisma.reservation.findFirst({
      where: { carId: oldCarId, status: { in: ['ACTIVE', 'CONFIRMED'] } },
    });
    if (!activeRes) {
      await prisma.car.update({
        where: { id: oldCarId },
        data: { status: CarStatus.AVAILABLE },
      });
    }
  }

  // Assign new car → RENTED
  if (newCarId) {
    const car = await prisma.car.findFirst({ where: { id: newCarId, agencyId } });
    if (!car) throw ApiError.notFound('Véhicule introuvable');
    await prisma.car.update({
      where: { id: newCarId },
      data: { status: CarStatus.RENTED },
    });
  }
}

export const ClientsService = {
  async findAll(agencyId: string, query: Record<string, unknown>) {
    const { page, limit, skip } = parsePaginationParams(query);

    const where: Prisma.ClientWhereInput = { agencyId, isActive: true };

    if (query.search) {
      const s = String(query.search);
      where.OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { cin: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (query.city) where.city = { contains: String(query.city), mode: 'insensitive' };
    if (query.blacklisted !== undefined) where.blacklisted = query.blacklisted === 'true';

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedCar: { select: { id: true, brand: true, model: true, licensePlate: true } },
          _count: { select: { reservations: true } },
        },
      }),
      prisma.client.count({ where }),
    ]);

    return { clients, meta: buildPaginationMeta(total, page, limit) };
  },

  async findById(agencyId: string, clientId: string) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, agencyId, isActive: true },
      include: {
        assignedCar: { select: { id: true, brand: true, model: true, licensePlate: true } },
        reservations: {
          orderBy: { startDate: 'desc' },
          take: 10,
          include: { car: { select: { brand: true, model: true, licensePlate: true } } },
        },
        _count: { select: { reservations: true } },
      },
    });

    if (!client) throw ApiError.notFound('Client introuvable');
    return client;
  },

  async create(agencyId: string, dto: CreateClientDto) {
    const existing = await prisma.client.findFirst({
      where: { agencyId, cin: dto.cin },
    });
    if (existing) throw ApiError.conflict('Un client avec ce CIN existe déjà dans cette agence');

    await handleCarAssignment(agencyId, dto.assignedCarId, null);

    return prisma.client.create({
      data: {
        ...dto,
        agencyId,
        licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : null,
      } as any,
      include: {
        assignedCar: { select: { id: true, brand: true, model: true, licensePlate: true } },
      },
    });
  },

  async update(agencyId: string, clientId: string, dto: UpdateClientDto) {
    const existing = await ClientsService.findById(agencyId, clientId);

    if (dto.cin) {
      const cinConflict = await prisma.client.findFirst({
        where: { agencyId, cin: dto.cin, id: { not: clientId } },
      });
      if (cinConflict) throw ApiError.conflict('Ce CIN est déjà utilisé');
    }

    // Handle car reassignment if assignedCarId changed
    if ('assignedCarId' in dto) {
      await handleCarAssignment(agencyId, dto.assignedCarId, existing.assignedCarId);
    }

    return prisma.client.update({
      where: { id: clientId },
      data: {
        ...dto,
        licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : undefined,
      },
      include: {
        assignedCar: { select: { id: true, brand: true, model: true, licensePlate: true } },
      },
    });
  },

  async delete(agencyId: string, clientId: string) {
    const client = await ClientsService.findById(agencyId, clientId);

    const activeReservation = await prisma.reservation.findFirst({
      where: { clientId, status: { in: ['ACTIVE', 'CONFIRMED'] } },
    });
    if (activeReservation) {
      throw ApiError.conflict('Impossible de supprimer un client avec des réservations actives');
    }

    // Unassign car before deleting
    if (client.assignedCarId) {
      await handleCarAssignment(agencyId, null, client.assignedCarId);
    }

    await prisma.client.update({
      where: { id: clientId },
      data: { isActive: false, assignedCarId: null },
    });
  },

  async getStats(agencyId: string) {
    const [total, blacklisted, topClients] = await Promise.all([
      prisma.client.count({ where: { agencyId, isActive: true } }),
      prisma.client.count({ where: { agencyId, blacklisted: true } }),
      prisma.client.findMany({
        where: { agencyId, isActive: true },
        orderBy: { totalSpent: 'desc' },
        take: 5,
        select: { id: true, firstName: true, lastName: true, totalRentals: true, totalSpent: true },
      }),
    ]);

    return { total, blacklisted, topClients };
  },
};
