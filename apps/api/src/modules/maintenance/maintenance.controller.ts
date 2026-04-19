import type { Request, Response } from 'express';
import { MaintenanceService } from './maintenance.service';

export const MaintenanceController = {
  async getAll(req: Request, res: Response) {
    const agencyId = req.user!.agencyId!;
    const { carId, status, type } = req.query as any;
    const tasks = await MaintenanceService.findAll(agencyId, { carId, status, type });
    res.json({ success: true, data: tasks });
  },

  async getById(req: Request, res: Response) {
    const agencyId = req.user!.agencyId!;
    const task = await MaintenanceService.findById(agencyId, req.params.id);
    res.json({ success: true, data: task });
  },

  async create(req: Request, res: Response) {
    const agencyId = req.user!.agencyId!;
    const task = await MaintenanceService.create(agencyId, req.body);
    res.status(201).json({ success: true, data: task });
  },

  async update(req: Request, res: Response) {
    const agencyId = req.user!.agencyId!;
    const task = await MaintenanceService.update(agencyId, req.params.id, req.body);
    res.json({ success: true, data: task });
  },

  async delete(req: Request, res: Response) {
    const agencyId = req.user!.agencyId!;
    await MaintenanceService.delete(agencyId, req.params.id);
    res.json({ success: true, message: 'Tâche supprimée' });
  },
};
