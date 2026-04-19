import { z } from 'zod';

export const createMaintenanceSchema = z.object({
  carId:          z.string().min(1, 'Véhicule requis'),
  type:           z.enum(['VIDANGE','PNEUS','REPARATION','VISITE_TECHNIQUE','CHECK','AUTRE']),
  date:           z.string().min(1, 'Date requise'),
  expirationDate: z.string().optional(),
  mileage:        z.number().int().min(0).optional(),
  cost:           z.number().min(0).optional(),
  status:         z.enum(['PENDING','IN_PROGRESS','COMPLETED']).default('PENDING'),
  notes:          z.string().optional(),
});

export const updateMaintenanceSchema = createMaintenanceSchema.partial();

export type CreateMaintenanceDto = z.infer<typeof createMaintenanceSchema>;
export type UpdateMaintenanceDto = z.infer<typeof updateMaintenanceSchema>;
