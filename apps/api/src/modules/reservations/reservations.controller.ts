import { Request, Response } from 'express';
import { ReservationsService } from './reservations.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { getAgencyId } from '../../middleware/tenant.middleware';

export const ReservationsController = {
  async index(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const result = await ReservationsService.findAll(agencyId, req.query as any);
    ApiResponse.paginated(res, result.reservations, result.meta);
  },

  async show(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const reservation = await ReservationsService.findById(agencyId, req.params.id);
    ApiResponse.success(res, reservation);
  },

  async create(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const reservation = await ReservationsService.create(agencyId, req.body);
    ApiResponse.created(res, reservation, 'Réservation créée avec succès');
  },

  async update(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const reservation = await ReservationsService.update(agencyId, req.params.id, req.body);
    ApiResponse.success(res, reservation, 'Réservation mise à jour');
  },

  async confirm(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const reservation = await ReservationsService.confirm(agencyId, req.params.id);
    ApiResponse.success(res, reservation, 'Réservation confirmée');
  },

  async activate(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const reservation = await ReservationsService.activate(agencyId, req.params.id, req.body.startMileage);
    ApiResponse.success(res, reservation, 'Véhicule remis au client');
  },

  async complete(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const reservation = await ReservationsService.complete(agencyId, req.params.id, req.body);
    ApiResponse.success(res, reservation, 'Réservation clôturée avec succès');
  },

  async cancel(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const reservation = await ReservationsService.cancel(agencyId, req.params.id, req.body.reason);
    ApiResponse.success(res, reservation, 'Réservation annulée');
  },

  async stats(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const stats = await ReservationsService.getStats(agencyId);
    ApiResponse.success(res, stats);
  },

  async remove(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    await ReservationsService.remove(agencyId, req.params.id);
    ApiResponse.success(res, null, 'Réservation supprimée');
  },

  async cleanupOverdue(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const result = await ReservationsService.cleanupOverdue(agencyId);
    ApiResponse.success(res, result, `${result.updated} véhicule(s) mis à jour`);
  },
};
