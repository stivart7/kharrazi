import { Request, Response } from 'express';
import { CarsService } from './cars.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { getAgencyId } from '../../middleware/tenant.middleware';

export const CarsController = {
  async index(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const result = await CarsService.findAll(agencyId, req.query as any);
    ApiResponse.paginated(res, result.cars, result.meta);
  },

  async show(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const car = await CarsService.findById(agencyId, req.params.id);
    ApiResponse.success(res, car);
  },

  async create(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const car = await CarsService.create(agencyId, req.body);
    ApiResponse.created(res, car, 'Véhicule ajouté avec succès');
  },

  async update(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const car = await CarsService.update(agencyId, req.params.id, req.body);
    ApiResponse.success(res, car, 'Véhicule mis à jour');
  },

  async delete(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    await CarsService.delete(agencyId, req.params.id);
    ApiResponse.success(res, null, 'Véhicule supprimé');
  },

  async checkAvailability(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const { startDate, endDate, excludeReservationId } = req.query as any;
    const result = await CarsService.checkAvailability(
      agencyId,
      req.params.id,
      new Date(startDate),
      new Date(endDate),
      excludeReservationId
    );
    ApiResponse.success(res, result);
  },

  async stats(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const stats = await CarsService.getStats(agencyId);
    ApiResponse.success(res, stats);
  },
};
