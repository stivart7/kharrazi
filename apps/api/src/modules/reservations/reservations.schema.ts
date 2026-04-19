import { z } from 'zod';
import { ReservationStatus } from '@prisma/client';

export const createReservationSchema = z.object({
  carId:           z.string().min(1, 'Véhicule requis'),
  clientId:        z.string().min(1, 'Client requis'),
  startDate:       z.string().datetime('Date de début invalide'),
  endDate:         z.string().datetime('Date de fin invalide'),
  pickupLocation:  z.string().optional(),
  returnLocation:  z.string().optional(),
  discountPercent: z.number().min(0).max(100).default(0),
  status:          z.nativeEnum(ReservationStatus).optional(),
  isContract:           z.boolean().default(false),
  secondDriverFirstName: z.string().optional(),
  secondDriverLastName:  z.string().optional(),
  secondDriverCin:       z.string().optional(),
  secondDriverPhone:     z.string().optional(),
  notes:                z.string().optional(),
  // Payment fields (optional — creates a payment record if amountPaid > 0)
  amountPaid:      z.number().min(0).default(0),
  paymentMethod:   z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE']).default('CASH'),
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  { message: 'La date de fin doit être après la date de début', path: ['endDate'] }
);

export const updateReservationSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  pickupLocation: z.string().optional(),
  returnLocation: z.string().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  status: z.nativeEnum(ReservationStatus).optional(),
  startMileage: z.number().int().optional(),
  endMileage: z.number().int().optional(),
  fuelLevelStart: z.string().optional(),
  fuelLevelEnd: z.string().optional(),
  extraCharges: z.number().min(0).optional(),
});

export const completeReservationSchema = z.object({
  actualReturnDate: z.string().datetime(),
  endMileage: z.number().int().optional(),
  fuelLevelEnd: z.string().optional(),
  extraCharges: z.number().min(0).default(0),
  notes: z.string().optional(),
});

export type CreateReservationDto = z.infer<typeof createReservationSchema>;
export type UpdateReservationDto = z.infer<typeof updateReservationSchema>;
export type CompleteReservationDto = z.infer<typeof completeReservationSchema>;
