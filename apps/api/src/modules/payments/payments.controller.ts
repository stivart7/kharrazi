import { Request, Response } from 'express';
import { PaymentsService, createPaymentSchema } from './payments.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { getAgencyId } from '../../middleware/tenant.middleware';

export const PaymentsController = {
  async index(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const result = await PaymentsService.findAll(agencyId, req.query as any);
    ApiResponse.paginated(res, result.payments, result.meta);
  },

  async create(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const dto = createPaymentSchema.parse(req.body);
    const payment = await PaymentsService.create(agencyId, dto);
    ApiResponse.created(res, payment, 'Paiement enregistré');
  },

  async financialSummary(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const period = (req.query.period as any) ?? 'month';
    const summary = await PaymentsService.getFinancialSummary(agencyId, period);
    ApiResponse.success(res, summary);
  },

  async monthlyRevenue(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    const year = parseInt(String(req.query.year ?? new Date().getFullYear()), 10);
    const data = await PaymentsService.getMonthlyRevenue(agencyId, year);
    ApiResponse.success(res, data);
  },

  async remove(req: Request, res: Response) {
    const agencyId = getAgencyId(req);
    await PaymentsService.remove(agencyId, req.params.id);
    ApiResponse.success(res, null, 'Paiement supprimé');
  },
};
