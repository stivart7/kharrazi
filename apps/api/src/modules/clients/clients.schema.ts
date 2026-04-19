import { z } from 'zod';

export const createClientSchema = z.object({
  firstName: z.string().min(2, 'Prénom requis'),
  lastName: z.string().min(2, 'Nom requis'),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(8, 'Téléphone requis'),
  cin: z.string().optional().default(''),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  nationality: z.string().default('Moroccan'),
  licenseNumber: z.string().optional().nullable(),
  licenseExpiry: z.string().datetime().optional().nullable(),
  licenseCountry: z.string().optional().nullable(),
  passportNumber: z.string().optional().nullable(),
  notes:        z.string().optional().nullable(),
  assignedCarId: z.string().optional().nullable(),
});

export const updateClientSchema = createClientSchema.partial().extend({
  riskScore: z.number().int().min(0).max(100).optional(),
  blacklisted: z.boolean().optional(),
});

export const clientQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  city: z.string().optional(),
  blacklisted: z.string().optional(),
});

export type CreateClientDto = z.infer<typeof createClientSchema>;
export type UpdateClientDto = z.infer<typeof updateClientSchema>;
