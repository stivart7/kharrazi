import * as https from 'https';
import { prisma } from '../config/database';
import { CarStatus, PaymentStatus, ReservationStatus } from '@prisma/client';
import { AILang } from './ai-command-parser.service';

// ── Coach system prompt ────────────────────────
const COACH_SYSTEM_PROMPT = `You are an expert business coach specialized in car rental agencies in Morocco (Moroccan market, MAD currency).

You receive REAL performance data from the agency. Your job is to analyze it and give strategic, actionable advice.

RULES:
- Respond in the EXACT language of the user's question (Darija / Arabic / French / English)
- Never give generic advice — always refer to the actual numbers provided
- Be direct, structured, and professional
- Max 350 words per response
- Always base recommendations on the real data

ALWAYS use this structure (with emojis):
📊 **Analyse** — what the numbers show (2-3 sentences)
⚠️ **Problème détecté** — the main issue (if any), be specific
💡 **Recommandations** — exactly 3 numbered actions to take NOW
🚀 **Impact attendu** — what will change if they follow your advice (be specific with % or MAD estimates)

If the data is good, say so clearly and suggest how to maintain or grow further.
If asking for a weekly plan, give a concrete day-by-day or priority list.`;

// ── Gather real agency context ─────────────────
async function gatherAgencyContext(agencyId: string): Promise<string> {
  const now             = new Date();
  const startOfMonth    = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth  = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const startOfWeek     = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay() + 1);

  const [
    carsStats,
    avgPrice,
    thisMonthRevenue,
    lastMonthRevenue,
    thisMonthReservations,
    lastMonthReservations,
    thisWeekReservations,
    pendingCount,
    activeCount,
    cancelledThisMonth,
    topCars,
    upcomingReturns,
    maintenanceDue,
  ] = await Promise.all([
    prisma.car.groupBy({
      by: ['status'],
      where: { agencyId, isActive: true },
      _count: true,
    }),
    prisma.car.aggregate({
      where: { agencyId, isActive: true },
      _avg: { pricePerDay: true },
    }),
    prisma.payment.aggregate({
      where: { agencyId, status: PaymentStatus.PAID, createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { agencyId, status: PaymentStatus.PAID, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      _sum: { amount: true },
    }),
    prisma.reservation.count({
      where: { agencyId, createdAt: { gte: startOfMonth } },
    }),
    prisma.reservation.count({
      where: { agencyId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
    }),
    prisma.reservation.count({
      where: { agencyId, createdAt: { gte: startOfWeek } },
    }),
    prisma.reservation.count({ where: { agencyId, status: ReservationStatus.PENDING } }),
    prisma.reservation.count({ where: { agencyId, status: ReservationStatus.ACTIVE } }),
    prisma.reservation.count({
      where: { agencyId, status: ReservationStatus.CANCELLED, createdAt: { gte: startOfMonth } },
    }),
    prisma.car.findMany({
      where: { agencyId, isActive: true },
      select: {
        brand: true, model: true, pricePerDay: true, status: true,
        _count: { select: { reservations: true } },
      },
      orderBy: { reservations: { _count: 'desc' } },
      take: 5,
    }),
    prisma.reservation.count({
      where: {
        agencyId,
        status: ReservationStatus.ACTIVE,
        endDate: { lte: new Date(Date.now() + 72 * 60 * 60 * 1000) },
      },
    }),
    prisma.car.count({
      where: {
        agencyId, isActive: true,
        OR: [
          { nextMaintenance: { lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) } },
          { status: CarStatus.MAINTENANCE },
        ],
      },
    }),
  ]);

  // Compute metrics
  const statusMap: Record<string, number> = {};
  carsStats.forEach((s) => { statusMap[s.status] = s._count; });

  const totalCars    = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const available    = statusMap[CarStatus.AVAILABLE]   ?? 0;
  const rented       = statusMap[CarStatus.RENTED]      ?? 0;
  const maintenance  = statusMap[CarStatus.MAINTENANCE] ?? 0;
  const outOfService = statusMap['OUT_OF_SERVICE']       ?? 0;
  const utilization  = totalCars > 0 ? Math.round((rented / totalCars) * 100) : 0;
  const availPct     = totalCars > 0 ? Math.round((available / totalCars) * 100) : 0;

  const thisRev  = Number(thisMonthRevenue._sum.amount  ?? 0);
  const lastRev  = Number(lastMonthRevenue._sum.amount  ?? 0);
  const revGrowth = lastRev > 0 ? Math.round(((thisRev - lastRev) / lastRev) * 100) : null;
  const resGrowth = lastMonthReservations > 0
    ? Math.round(((thisMonthReservations - lastMonthReservations) / lastMonthReservations) * 100)
    : null;

  const avgPricePerDay = Math.round(Number(avgPrice._avg.pricePerDay ?? 0));
  const dayOfMonth  = now.getDate();
  const projRevenue = dayOfMonth > 1 && thisRev > 0
    ? Math.round((thisRev / dayOfMonth) * 30)
    : null;

  const fmtMAD = (n: number) => `${n.toLocaleString('fr-MA')} MAD`;

  return `
=== AGENCY REAL-TIME DATA ===
Report date: ${now.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
Day of month: ${dayOfMonth}/30

--- FLEET ---
Total active vehicles: ${totalCars}
  • Available NOW: ${available} (${availPct}%)
  • Currently rented: ${rented} (utilization: ${utilization}%)
  • In maintenance: ${maintenance}
  • Out of service: ${outOfService}
Average price per day: ${fmtMAD(avgPricePerDay)}
Vehicles with maintenance due (14 days): ${maintenanceDue}

--- REVENUE ---
This month (so far): ${fmtMAD(thisRev)}
Last month (full): ${fmtMAD(lastRev)}
Month-over-month change: ${revGrowth !== null ? `${revGrowth > 0 ? '+' : ''}${revGrowth}%` : 'N/A (first month)'}
${projRevenue ? `Projected end-of-month (at current pace): ${fmtMAD(projRevenue)}` : ''}

--- RESERVATIONS ---
This month: ${thisMonthReservations} reservations
Last month: ${lastMonthReservations} reservations
Change: ${resGrowth !== null ? `${resGrowth > 0 ? '+' : ''}${resGrowth}%` : 'N/A'}
This week: ${thisWeekReservations} reservations
Currently active rentals: ${activeCount}
Pending confirmation: ${pendingCount}
Cancelled this month: ${cancelledThisMonth}
Upcoming returns (72h): ${upcomingReturns}

--- TOP VEHICLES BY BOOKINGS ---
${topCars.map((c, i) =>
  `${i + 1}. ${c.brand} ${c.model} — ${Number(c.pricePerDay)} MAD/day — ${c._count.reservations} total bookings — ${c.status}`
).join('\n')}
=== END DATA ===`;
}

// ── OpenAI coach call ──────────────────────────
async function callCoachOpenAI(message: string, context: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const body = JSON.stringify({
    model:       'gpt-4o-mini',
    messages: [
      { role: 'system', content: COACH_SYSTEM_PROMPT },
      { role: 'user',   content: `${context}\n\nOwner's question: ${message}` },
    ],
    temperature: 0.7,
    max_tokens:  700,
  });

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'api.openai.com',
      path:     '/v1/chat/completions',
      method:   'POST',
      headers:  {
        'Authorization':  `Bearer ${apiKey}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.choices[0].message.content);
          } catch {
            reject(new Error('OpenAI parse error'));
          }
        } else {
          reject(new Error(`OpenAI HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── No-key fallback ────────────────────────────
function noKeyResponse(lang: AILang): string {
  const msgs: Record<AILang, string> = {
    darija: '🔑 *Coach Mode* محتاج OpenAI API Key باش يخدم.\n\nزيد `OPENAI_API_KEY` فـ `.env` ومن بعد rebuild الـ containers.',
    ar:     '🔑 *وضع المدرب* يتطلب مفتاح OpenAI API للعمل.\n\nأضف `OPENAI_API_KEY` في ملف `.env` ثم أعد بناء الـ containers.',
    fr:     '🔑 *Coach Mode* nécessite une clé API OpenAI pour fonctionner.\n\nAjoutez `OPENAI_API_KEY` dans le fichier `.env` puis reconstruisez les containers.',
    en:     '🔑 *Coach Mode* requires an OpenAI API Key to work.\n\nAdd `OPENAI_API_KEY` to your `.env` file and rebuild the containers.',
  };
  return msgs[lang] ?? msgs.fr;
}

// ── Public API ─────────────────────────────────
export async function runCoachMode(
  message: string,
  agencyId: string,
  lang: AILang,
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return noKeyResponse(lang);
  }

  try {
    const context = await gatherAgencyContext(agencyId);
    return await callCoachOpenAI(message, context);
  } catch (err) {
    console.error('[Coach] Error:', (err as Error).message);
    const errMsgs: Record<AILang, string> = {
      darija: '⚠️ مقدرتش نجاوبك دابا. عاود حاول من بعد شوية.',
      ar:     '⚠️ لم أتمكن من الإجابة الآن. يرجى المحاولة مرة أخرى.',
      fr:     '⚠️ Impossible de répondre pour le moment. Veuillez réessayer.',
      en:     '⚠️ Unable to respond right now. Please try again.',
    };
    return errMsgs[lang] ?? errMsgs.fr;
  }
}
