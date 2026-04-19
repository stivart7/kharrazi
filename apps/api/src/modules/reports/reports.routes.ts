import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { getAgencyId } from '../../middleware/tenant.middleware';
import { generatePDF } from '../../services/pdf.service';
import { generateExcel } from '../../services/excel.service';
import { ReportPeriod } from '../../services/report-data.service';

const router = Router();
router.use(authenticate);

const VALID_PERIODS: ReportPeriod[] = ['today', 'week', 'month', 'year'];

function resolveAgencyId(req: any): string | null {
  const role = req.user?.role;
  if (role === 'SUPER_ADMIN') return req.user?.agencyId ?? null;
  return getAgencyId(req);
}

// GET /api/reports/pdf?period=month
router.get('/pdf', async (req, res) => {
  const agencyId = resolveAgencyId(req);
  if (!agencyId) { res.status(400).json({ success: false, message: 'Agency introuvable' }); return; }

  const period = (VALID_PERIODS.includes(req.query.period as ReportPeriod)
    ? req.query.period
    : 'month') as ReportPeriod;

  await generatePDF(agencyId, period, res);
});

// GET /api/reports/excel?period=month
router.get('/excel', async (req, res) => {
  const agencyId = resolveAgencyId(req);
  if (!agencyId) { res.status(400).json({ success: false, message: 'Agency introuvable' }); return; }

  const period = (VALID_PERIODS.includes(req.query.period as ReportPeriod)
    ? req.query.period
    : 'month') as ReportPeriod;

  await generateExcel(agencyId, period, res);
});

export default router;
