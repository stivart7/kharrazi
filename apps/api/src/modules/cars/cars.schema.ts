import { z } from 'zod';
import { CarStatus, FuelType, Transmission } from '@prisma/client';

export const createCarSchema = z.object({
  brand: z.string().min(1, 'Marque requise'),
  model: z.string().min(1, 'Modèle requis'),
  year: z.number().int().min(2000).max(new Date().getFullYear() + 1),
  licensePlate: z.string().optional().default(''),
  isActive: z.boolean().optional(),
  color: z.string().optional(),
  fuelType: z.nativeEnum(FuelType).default(FuelType.GASOLINE),
  transmission: z.nativeEnum(Transmission).default(Transmission.MANUAL),
  seats: z.number().int().min(2).max(15).default(5),
  doors: z.number().int().min(2).max(6).default(4),
  pricePerDay: z.number().positive('Prix par jour requis'),
  weeklyDiscount: z.number().min(0).max(50).default(0),
  monthlyDiscount: z.number().min(0).max(50).default(0),
  deposit: z.number().positive().optional(),
  mileage: z.number().int().min(0).default(0),
  features: z.array(z.string()).default([]),
  description: z.string().optional(),
  lastMaintenance: z.string().datetime().optional().nullable(),
  nextMaintenance: z.string().datetime().optional().nullable(),
  insuranceExpiry:      z.string().optional().nullable(),
  technicalExpiry:      z.string().optional().nullable(),
  vignetteExpiry:       z.string().optional().nullable(),
  carteGriseDate:       z.string().optional().nullable(),
  autorisationExpiry:   z.string().optional().nullable(),
});

export const updateCarSchema = createCarSchema.partial().extend({
  status: z.nativeEnum(CarStatus).optional(),
});

export const carQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.nativeEnum(CarStatus).optional(),
  brand: z.string().optional(),
  fuelType: z.nativeEnum(FuelType).optional(),
  transmission: z.nativeEnum(Transmission).optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  search: z.string().optional(),
});

export type CreateCarDto = z.infer<typeof createCarSchema>;
export type UpdateCarDto = z.infer<typeof updateCarSchema>;
