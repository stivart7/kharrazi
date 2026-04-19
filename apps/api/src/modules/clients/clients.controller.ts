import { Request, Response } from 'express';
import { ClientsService } from './clients.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { getAgencyId } from '../../middleware/tenant.middleware';

export const ClientsController = {
  async index(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const result = await ClientsService.findAll(agencyId, req.query as any);
    ApiResponse.paginated(res, result.clients, result.meta);
  },

  async show(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const client = await ClientsService.findById(agencyId, req.params.id);
    ApiResponse.success(res, client);
  },

  async create(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const client = await ClientsService.create(agencyId, req.body);
    ApiResponse.created(res, client, 'Client créé avec succès');
  },

  async update(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const client = await ClientsService.update(agencyId, req.params.id, req.body);
    ApiResponse.success(res, client, 'Client mis à jour');
  },

  async delete(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    await ClientsService.delete(agencyId, req.params.id);
    ApiResponse.success(res, null, 'Client supprimé');
  },

  async stats(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const stats = await ClientsService.getStats(agencyId);
    ApiResponse.success(res, stats);
  },
};
