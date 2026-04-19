import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { MaintenanceController } from './maintenance.controller';
import { createMaintenanceSchema, updateMaintenanceSchema } from './maintenance.schema';

const router = Router();

router.use(authenticate);

router.get('/',    MaintenanceController.getAll);
router.get('/:id', MaintenanceController.getById);
router.post('/',   validate(createMaintenanceSchema), MaintenanceController.create);
router.patch('/:id', validate(updateMaintenanceSchema), MaintenanceController.update);
router.delete('/:id', MaintenanceController.delete);

export default router;
