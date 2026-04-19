import { Router } from 'express';
import { AnalyticsController } from './analytics.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireFeature } from '../../middleware/plan.middleware';

const router = Router();

router.use(authenticate);

// dashboard is available to all plans
router.get('/dashboard',     AnalyticsController.dashboard);
router.get('/revenue-chart', AnalyticsController.revenueChart);

// detailed reports require PRO+
router.get('/vehicles',  requireFeature('reports'), AnalyticsController.vehiclePerformance);
router.get('/financial', requireFeature('reports'), AnalyticsController.financialReport);
router.get('/clients',   requireFeature('reports'), AnalyticsController.clientsReport);

export default router;
