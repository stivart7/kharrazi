import { Router } from 'express';
import { ReservationsController } from './reservations.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createReservationSchema,
  completeReservationSchema,
} from './reservations.schema';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/stats', ReservationsController.stats);
router.post('/cleanup-overdue', authorize(Role.SUPER_ADMIN, Role.AGENCY_ADMIN, Role.EMPLOYEE), ReservationsController.cleanupOverdue);
router.get('/', ReservationsController.index);
router.get('/:id', ReservationsController.show);

router.post(
  '/',
  authorize(Role.SUPER_ADMIN, Role.AGENCY_ADMIN, Role.EMPLOYEE),
  validate(createReservationSchema),
  ReservationsController.create
);

router.patch('/:id', authorize(Role.SUPER_ADMIN, Role.AGENCY_ADMIN, Role.EMPLOYEE), ReservationsController.update);
router.post('/:id/confirm', authorize(Role.SUPER_ADMIN, Role.AGENCY_ADMIN, Role.EMPLOYEE), ReservationsController.confirm);
router.post('/:id/activate', authorize(Role.SUPER_ADMIN, Role.AGENCY_ADMIN, Role.EMPLOYEE), ReservationsController.activate);
router.post('/:id/complete', authorize(Role.SUPER_ADMIN, Role.AGENCY_ADMIN, Role.EMPLOYEE), validate(completeReservationSchema), ReservationsController.complete);
router.post('/:id/cancel', authorize(Role.SUPER_ADMIN, Role.AGENCY_ADMIN, Role.EMPLOYEE), ReservationsController.cancel);

router.delete('/:id', authorize(Role.SUPER_ADMIN, Role.AGENCY_ADMIN), ReservationsController.remove);

export default router;
