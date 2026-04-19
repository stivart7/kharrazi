import { Request, Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { getAgencyId } from '../../middleware/tenant.middleware';

export const AnalyticsController = {
  async dashboard(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const data = await AnalyticsService.getDashboard(agencyId);
    ApiResponse.success(res, data);
  },

  async revenueChart(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const year = parseInt(String(req.query.year ?? new Date().getFullYear()), 10);
    const data = await AnalyticsService.getRevenueChart(agencyId, year);
    ApiResponse.success(res, data);
  },

  async vehiclePerformance(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const data = await AnalyticsService.getVehiclePerformance(agencyId);
    ApiResponse.success(res, data);
  },

  async financialReport(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const data = await AnalyticsService.getFinancialReport(agencyId);
    ApiResponse.success(res, data);
  },

  async clientsReport(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const data = await AnalyticsService.getClientsReport(agencyId);
    ApiResponse.success(res, data);
  },
};
