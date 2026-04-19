import { Router } from 'express';
import { CarsController } from './cars.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createCarSchema, updateCarSchema } from './cars.schema';
import { checkVehicleLimit } from '../../middleware/plan.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/stats', CarsController.stats);
router.get('/', CarsController.index);
router.get('/:id', CarsController.show);
router.get('/:id/availability', CarsController.checkAvailability);

router.post(
  '/',
  authorize(Role.SUPER_ADMIN, Role.AGENCY_ADMIN, Role.EMPLOYEE),
  checkVehicleLimit,
  validate(createCarSchema),
  CarsController.create
);

router.patch(
  '/:id',
  authorize(Role.SUPER_ADMIN, Role.AGENCY_ADMIN, Role.EMPLOYEE),
  validate(updateCarSchema),
  CarsController.update
);

router.delete(
  '/:id',
  authorize(Role.SUPER_ADMIN, Role.AGENCY_ADMIN),
  CarsController.delete
);

export default router;
