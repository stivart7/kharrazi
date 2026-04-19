import { Router } from 'express';
import { ClientsController } from './clients.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createClientSchema, updateClientSchema } from './clients.schema';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/stats', ClientsController.stats);
router.get('/', ClientsController.index);
router.get('/:id', ClientsController.show);

router.post(
  '/',
  authorize(Role.SUPER_ADMIN, Role.AGENCY_ADMIN, Role.EMPLOYEE),
  validate(createClientSchema),
  ClientsController.create
);

router.patch(
  '/:id',
  authorize(Role.SUPER_ADMIN, Role.AGENCY_ADMIN, Role.EMPLOYEE),
  validate(updateClientSchema),
  ClientsController.update
);

router.delete(
  '/:id',
  authorize(Role.SUPER_ADMIN, Role.AGENCY_ADMIN),
  ClientsController.delete
);

export default router;
