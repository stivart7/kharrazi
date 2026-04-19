import { Router } from 'express';
import { PaymentsController } from './payments.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/summary', PaymentsController.financialSummary);
router.get('/monthly-revenue', PaymentsController.monthlyRevenue);
router.get('/', PaymentsController.index);

router.post(
  '/',
  authorize(Role.SUPER_ADMIN, Role.AGENCY_ADMIN, Role.EMPLOYEE, Role.ACCOUNTANT),
  PaymentsController.create
);

router.delete(
  '/:id',
  authorize(Role.SUPER_ADMIN, Role.AGENCY_ADMIN),
  PaymentsController.remove
);

export default router;
