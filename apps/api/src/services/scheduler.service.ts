import { prisma } from '../config/database';
import { WhatsappService } from './whatsapp.service';

// ── Run every hour ─────────────────────────────
export async function runScheduledJobs() {
  await check48hReminders();
}

// ── 48h return reminders ───────────────────────
async function check48hReminders() {
  try {
    const now    = new Date();
    const in48h  = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const in47h  = new Date(now.getTime() + 47 * 60 * 60 * 1000);

    // Reservations ending in ~48h (between 47h and 49h from now), duration > 2 days
    const reservations = await prisma.reservation.findMany({
      where: {
        status:  'ACTIVE',
        endDate: { gte: in47h, lte: new Date(now.getTime() + 49 * 60 * 60 * 1000) },
        totalDays: { gt: 2 },
      },
      include: {
        car:    { select: { brand: true, model: true } },
        client: { select: { firstName: true, lastName: true, phone: true } },
      },
    });

    for (const r of reservations) {
      await WhatsappService.notifyReminder(r.agencyId, {
        reservationId: r.id,
        carBrand:      r.car.brand,
        carModel:      r.car.model,
        clientName:    `${r.client.firstName} ${r.client.lastName}`,
        clientPhone:   r.client.phone ?? '—',
        returnDate:    new Date(r.endDate).toLocaleDateString('fr-MA'),
      });
    }
  } catch (err) {
    console.error('[Scheduler] 48h reminder error:', err);
  }
}
