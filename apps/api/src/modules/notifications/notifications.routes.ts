import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { getAgencyId } from '../../middleware/tenant.middleware';
import { prisma } from '../../config/database';
import { ApiResponse } from '../../utils/ApiResponse';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const waSettingsSchema = z.object({
  whatsappEnabled:    z.boolean().optional(),
  whatsappNumber:     z.string().optional().nullable(),
  notifyReservations: z.boolean().optional(),
  notifyReturns:      z.boolean().optional(),
  notifyReminders:    z.boolean().optional(),
  notifyPayments:     z.boolean().optional(),
  notifyMaintenance:  z.boolean().optional(),
});

// GET current WhatsApp settings
router.get('/whatsapp-settings', async (req, res) => {
  const agencyId = getAgencyId(req);
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      whatsappEnabled:    true,
      whatsappNumber:     true,
      notifyReservations: true,
      notifyReturns:      true,
      notifyReminders:    true,
      notifyPayments:     true,
      notifyMaintenance:  true,
    },
  });
  ApiResponse.success(res, agency);
});

// PATCH WhatsApp settings
router.patch('/whatsapp-settings', async (req, res) => {
  const agencyId = getAgencyId(req);
  const dto = waSettingsSchema.parse(req.body);
  const updated = await prisma.agency.update({
    where: { id: agencyId },
    data: dto,
    select: {
      whatsappEnabled:    true,
      whatsappNumber:     true,
      notifyReservations: true,
      notifyReturns:      true,
      notifyReminders:    true,
      notifyPayments:     true,
      notifyMaintenance:  true,
    },
  });
  ApiResponse.success(res, updated, 'Paramètres WhatsApp mis à jour');
});

// POST test message
router.post('/whatsapp-test', async (req, res) => {
  const agencyId = getAgencyId(req);
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { whatsappEnabled: true, whatsappNumber: true, name: true },
  });

  if (!agency?.whatsappEnabled || !agency.whatsappNumber) {
    return ApiResponse.success(res, null, 'WhatsApp non configuré');
  }

  // Dynamic import to avoid loading at startup if not needed
  const { WhatsappService } = await import('../../services/whatsapp.service');
  // Temporarily bypass log deduplication for test
  const { prisma: db } = await import('../../config/database');
  await db.whatsappLog.deleteMany({ where: { agencyId, type: 'reservation', referenceId: 'TEST' } }).catch(() => {});

  await WhatsappService.notifyNewReservation(agencyId, {
    reservationId: 'TEST',
    clientName: 'Client Test',
    carBrand: 'Dacia',
    carModel: 'Logan',
    startDate: new Date().toLocaleDateString('fr-MA'),
    endDate: new Date(Date.now() + 3 * 86400000).toLocaleDateString('fr-MA'),
  });

  ApiResponse.success(res, null, 'Message test envoyé');
});

export default router;
