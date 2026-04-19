import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import type { CreateMaintenanceDto, UpdateMaintenanceDto } from './maintenance.schema';

export const MaintenanceService = {

  async findAll(agencyId: string, query: { carId?: string; status?: string; type?: string }) {
    const where: any = { agencyId };
    if (query.carId)  where.carId  = query.carId;
    if (query.status) where.status = query.status;
    if (query.type)   where.type   = query.type;

    return prisma.maintenance.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        car: { select: { id: true, brand: true, model: true, licensePlate: true, status: true } },
      },
    });
  },

  async findById(agencyId: string, id: string) {
    const task = await prisma.maintenance.findFirst({
      where: { id, agencyId },
      include: {
        car: { select: { id: true, brand: true, model: true, licensePlate: true } },
      },
    });
    if (!task) throw ApiError.notFound('Tâche de maintenance introuvable');
    return task;
  },

  async create(agencyId: string, dto: CreateMaintenanceDto) {
    const car = await prisma.car.findFirst({ where: { id: dto.carId, agencyId } });
    if (!car) throw ApiError.notFound('Véhicule introuvable');

    return prisma.maintenance.create({
      data: {
        agencyId,
        carId:          dto.carId,
        type:           dto.type as any,
        date:           new Date(dto.date),
        expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : undefined,
        mileage:        dto.mileage,
        cost:           dto.cost,
        status:         (dto.status ?? 'PENDING') as any,
        notes:          dto.notes,
      },
      include: {
        car: { select: { id: true, brand: true, model: true, licensePlate: true } },
      },
    });
  },

  async update(agencyId: string, id: string, dto: UpdateMaintenanceDto) {
    const task = await MaintenanceService.findById(agencyId, id);

    const data: any = {};
    if (dto.type)           data.type           = dto.type;
    if (dto.date)           data.date           = new Date(dto.date);
    if (dto.status)         data.status         = dto.status;
    if (dto.mileage !== undefined) data.mileage = dto.mileage;
    if (dto.cost    !== undefined) data.cost    = dto.cost;
    if (dto.notes   !== undefined) data.notes   = dto.notes;
    if (dto.expirationDate !== undefined)
      data.expirationDate = dto.expirationDate ? new Date(dto.expirationDate) : null;

    const updated = await prisma.maintenance.update({
      where: { id },
      data,
      include: {
        car: { select: { id: true, brand: true, model: true, licensePlate: true, status: true } },
      },
    });

    // If task is now COMPLETED, check if car can go back to AVAILABLE
    if (dto.status === 'COMPLETED') {
      await MaintenanceService.releaseCarIfDone(agencyId, task.carId);
    }

    return updated;
  },

  async delete(agencyId: string, id: string) {
    const task = await MaintenanceService.findById(agencyId, id);
    await prisma.maintenance.delete({ where: { id } });

    // After deletion, check if car can go back to AVAILABLE
    await MaintenanceService.releaseCarIfDone(agencyId, task.carId);
  },

  // Set car back to AVAILABLE if no more PENDING/IN_PROGRESS maintenance tasks
  async releaseCarIfDone(agencyId: string, carId: string) {
    const car = await prisma.car.findFirst({ where: { id: carId, agencyId } });
    if (!car || car.status !== 'MAINTENANCE') return;

    const activeTasks = await prisma.maintenance.count({
      where: { carId, agencyId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });

    if (activeTasks === 0) {
      await prisma.car.update({
        where: { id: carId },
        data: { status: 'AVAILABLE' },
      });
    }
  },

  // Called when a rental is completed — auto-create a post-rental CHECK task
  async createPostRentalCheck(agencyId: string, carId: string) {
    await prisma.maintenance.create({
      data: {
        agencyId,
        carId,
        type:   'CHECK' as any,
        date:   new Date(),
        status: 'PENDING' as any,
        notes:  'Inspection post-location',
      },
    });
  },
};
