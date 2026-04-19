import * as https from 'https';
import { prisma } from '../config/database';

const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM  = process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886'; // Twilio sandbox default

export type WaEventType = 'reservation' | 'return' | 'reminder' | 'payment' | 'maintenance';

// ── Send one WhatsApp message via Twilio ───────
async function sendMessage(to: string, body: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    console.log('[WhatsApp] Credentials not configured — message skipped:', body);
    return false;
  }

  return new Promise((resolve) => {
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const payload = new URLSearchParams({
      From: TWILIO_FROM,
      To:   toNumber,
      Body: body,
    }).toString();

    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
    const options: https.RequestOptions = {
      hostname: 'api.twilio.com',
      path:     `/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization':  `Basic ${auth}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          console.error('[WhatsApp] Send error:', res.statusCode, data);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error('[WhatsApp] Request error:', err.message);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

// ── Check duplicate & log ──────────────────────
async function alreadySent(type: WaEventType, referenceId: string): Promise<boolean> {
  const existing = await prisma.whatsappLog.findUnique({
    where: { type_referenceId: { type, referenceId } },
  });
  return !!existing;
}

async function markSent(agencyId: string, type: WaEventType, referenceId: string) {
  await prisma.whatsappLog.upsert({
    where:  { type_referenceId: { type, referenceId } },
    create: { agencyId, type, referenceId },
    update: { sentAt: new Date() },
  });
}

// ── Fetch agency whatsapp settings ────────────
async function getAgencyWa(agencyId: string) {
  return prisma.agency.findUnique({
    where:  { id: agencyId },
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
}

// ═══════════════════════════════════════════════
//  Public notification methods
// ═══════════════════════════════════════════════

export const WhatsappService = {

  // 📅 New reservation created
  async notifyNewReservation(agencyId: string, data: {
    reservationId: string;
    clientName: string;
    carBrand: string;
    carModel: string;
    startDate: string;
    endDate: string;
  }) {
    const agency = await getAgencyWa(agencyId);
    if (!agency?.whatsappEnabled || !agency.whatsappNumber || !agency.notifyReservations) return;
    if (await alreadySent('reservation', data.reservationId)) return;

    const msg =
      `📅 *Nouvelle réservation*\n` +
      `Client : ${data.clientName}\n` +
      `Véhicule : ${data.carBrand} ${data.carModel}\n` +
      `Période : ${data.startDate} → ${data.endDate}`;

    const ok = await sendMessage(agency.whatsappNumber, msg);
    if (ok) await markSent(agencyId, 'reservation', data.reservationId);
  },

  // 🚗 Vehicle returned
  async notifyReturn(agencyId: string, data: {
    reservationId: string;
    carBrand: string;
    carModel: string;
    clientName: string;
  }) {
    const agency = await getAgencyWa(agencyId);
    if (!agency?.whatsappEnabled || !agency.whatsappNumber || !agency.notifyReturns) return;
    if (await alreadySent('return', data.reservationId)) return;

    const msg =
      `🚗 *Véhicule restitué*\n` +
      `${data.carBrand} ${data.carModel} est de nouveau disponible.\n` +
      `Client : ${data.clientName}`;

    const ok = await sendMessage(agency.whatsappNumber, msg);
    if (ok) await markSent(agencyId, 'return', data.reservationId);
  },

  // ⏰ 48h reminder
  async notifyReminder(agencyId: string, data: {
    reservationId: string;
    carBrand: string;
    carModel: string;
    clientName: string;
    clientPhone: string;
    returnDate: string;
  }) {
    const agency = await getAgencyWa(agencyId);
    if (!agency?.whatsappEnabled || !agency.whatsappNumber || !agency.notifyReminders) return;
    if (await alreadySent('reminder', data.reservationId)) return;

    const msg =
      `⏰ *Rappel de retour — 48h*\n` +
      `Véhicule : ${data.carBrand} ${data.carModel}\n` +
      `Client : ${data.clientName} (${data.clientPhone})\n` +
      `Retour prévu : ${data.returnDate}`;

    const ok = await sendMessage(agency.whatsappNumber, msg);
    if (ok) await markSent(agencyId, 'reminder', data.reservationId);
  },

  // 💰 Payment received
  async notifyPayment(agencyId: string, data: {
    paymentId: string;
    clientName: string;
    amount: number;
    method: string;
  }) {
    const agency = await getAgencyWa(agencyId);
    if (!agency?.whatsappEnabled || !agency.whatsappNumber || !agency.notifyPayments) return;
    if (await alreadySent('payment', data.paymentId)) return;

    const msg =
      `💰 *Paiement reçu*\n` +
      `Client : ${data.clientName}\n` +
      `Montant : ${data.amount.toLocaleString('fr-MA')} MAD\n` +
      `Mode : ${data.method}`;

    const ok = await sendMessage(agency.whatsappNumber, msg);
    if (ok) await markSent(agencyId, 'payment', data.paymentId);
  },

  // 🛠 Maintenance alert
  async notifyMaintenance(agencyId: string, data: {
    carId: string;
    carBrand: string;
    carModel: string;
    licensePlate: string;
    reason: string;
  }) {
    const agency = await getAgencyWa(agencyId);
    if (!agency?.whatsappEnabled || !agency.whatsappNumber || !agency.notifyMaintenance) return;
    if (await alreadySent('maintenance', data.carId)) return;

    const msg =
      `🛠 *Alerte maintenance*\n` +
      `Véhicule : ${data.carBrand} ${data.carModel} (${data.licensePlate})\n` +
      `Motif : ${data.reason}`;

    const ok = await sendMessage(agency.whatsappNumber, msg);
    if (ok) await markSent(agencyId, 'maintenance', data.carId);
  },
};
