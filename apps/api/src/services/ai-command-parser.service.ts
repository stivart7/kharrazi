import * as https from 'https';

// ── Types ──────────────────────────────────────────
export type AIAction =
  | 'get_report'
  | 'get_revenue'
  | 'get_reservations'
  | 'get_cars'
  | 'get_plates'
  | 'get_maintenance_due'
  | 'get_clients'
  | 'add_car'
  | 'delete_car'
  | 'get_upcoming'
  | 'get_overdue'
  | 'find_client'
  | 'add_client'
  | 'find_car'
  | 'get_pending_payments'
  | 'get_stats_summary'
  | 'unknown';

export type AILang = 'ar' | 'fr' | 'en' | 'darija';

export interface ParsedCommand {
  action: AIAction;
  data:   Record<string, any>;
  lang:   AILang;
}

// ── System prompt ──────────────────────────────────
const SYSTEM_PROMPT = `You are a command parser for a Moroccan car rental management SaaS.
Parse the user's message (Darija, Arabic, French, or English) into a JSON command.

Respond ONLY with valid JSON — no extra text.

Schema:
{
  "action": "get_report"|"get_revenue"|"get_reservations"|"get_cars"|"get_plates"|"get_maintenance_due"|"get_clients"|"add_car"|"delete_car"|"get_upcoming"|"get_overdue"|"find_client"|"add_client"|"find_car"|"get_pending_payments"|"get_stats_summary"|"unknown",
  "data": {},
  "lang": "ar"|"fr"|"en"|"darija"
}

Action data schemas:
- get_report:           { "period": "today"|"week"|"month"|"year" }
- get_revenue:          { "period": "today"|"week"|"month"|"year" }
- get_reservations:     { "period": "today"|"week"|"month"|"year", "status": "PENDING"|"ACTIVE"|"COMPLETED"|"CANCELLED"|null }
- get_cars:             { "status": "AVAILABLE"|"RENTED"|"MAINTENANCE"|null, "query": string|null }
- get_plates:           { "status": "AVAILABLE"|"RENTED"|"MAINTENANCE"|null, "query": string|null }
- get_maintenance_due:  { "days": number }
- get_clients:          {}
- add_car:              { "brand": string, "model": string, "year": number, "licensePlate": string, "pricePerDay": number, "deposit": number, "fuelType": "GASOLINE"|"DIESEL"|"HYBRID"|"ELECTRIC" }
- delete_car:           { "query": string }
- get_upcoming:         { "days": number }
- get_overdue:          {}
- find_client:          { "query": string }
- add_client:           { "firstName": string, "lastName": string, "phone": string, "cin": string, "email": string|null }
- find_car:             { "query": string }
- get_pending_payments: {}
- get_stats_summary:    {}
- unknown:              {}

Action selection rules:
- "matricule/plaque/immatriculation/لوحة/numeros" → get_plates. If user mentions a specific brand/model/plate after "dyal/de/of/ديال", extract it as "query". Otherwise query is null.
- "maintenance/entretien/révision/vidange/9rib maintenance/proche maintenance/قريب الصيانة" → get_maintenance_due (days: 30 unless specified)
- "assurance/تأمين/visite technique" expiry → get_maintenance_due (days: 30)
- "retours/rendre/retourner/retard/متأخر/marachoch" → get_overdue
- "prochains retours/upcoming returns/ghadi iraj3o/rj3o" → get_upcoming (days: 3 unless specified)
- "chercher client/find client/client [name]/tcherch/بحث عن عميل" → find_client
- "ajouter client/add client/zid client/زيد عميل" → add_client
- "chercher voiture/find car/tcherch voiture/بحث عن سيارة" → find_car
- "paiements en attente/pending payments/paiement/doit/makhlass" → get_pending_payments
- "résumé/summary/kif kayn/كيف الحال/overview/vue d'ensemble" → get_stats_summary

Normalization:
- Remove "درهم", "dh", "MAD" from prices — keep number only
- "اليوم/aujourd'hui/today" → "today", "الأسبوع/semaine/week" → "week", "الشهر/mois/month" → "month", "السنة/année/year" → "year"
- Normalize brand names: دارتشيا→Dacia, رونو→Renault, بيجو→Peugeot, تويوتا→Toyota, هيونداي→Hyundai
- Default deposit to 0 if not mentioned
- Default fuelType to "GASOLINE" if not mentioned
- Detect message language for "lang" field

Examples:
"عطيني rapport ديال اليوم" → {"action":"get_report","data":{"period":"today"},"lang":"darija"}
"كم ريزرفاسيون هاد الشهر" → {"action":"get_reservations","data":{"period":"month","status":null},"lang":"darija"}
"عطيني les matriculations" → {"action":"get_plates","data":{"status":null,"query":null},"lang":"darija"}
"matriculation dyal deuster" → {"action":"get_plates","data":{"status":null,"query":"Duster"},"lang":"darija"}
"plaque dyal clio" → {"action":"get_plates","data":{"status":null,"query":"Clio"},"lang":"darija"}
"les plaques des Dacia" → {"action":"get_plates","data":{"status":null,"query":"Dacia"},"lang":"fr"}
"quel est le numéro de la Logan" → {"action":"get_plates","data":{"status":null,"query":"Logan"},"lang":"fr"}
"tomobilat li 9rib lihom maintenance" → {"action":"get_maintenance_due","data":{"days":30},"lang":"darija"}
"زيد دارتشيا لوغان 2022 A-12345-B 300 درهم" → {"action":"add_car","data":{"brand":"Dacia","model":"Logan","year":2022,"licensePlate":"A-12345-B","pricePerDay":300,"deposit":0,"fuelType":"GASOLINE"},"lang":"darija"}
"rapport des revenus du mois" → {"action":"get_revenue","data":{"period":"month"},"lang":"fr"}
"available cars" → {"action":"get_cars","data":{"status":"AVAILABLE","query":null},"lang":"en"}
"vehicule disponible" → {"action":"get_cars","data":{"status":"AVAILABLE","query":null},"lang":"fr"}
"tomobilat disponibles" → {"action":"get_cars","data":{"status":"AVAILABLE","query":null},"lang":"darija"}
"tomobilat f location" → {"action":"get_cars","data":{"status":"RENTED","query":null},"lang":"darija"}
"سوپريمي السيارة A-34567-B" → {"action":"delete_car","data":{"query":"A-34567-B"},"lang":"ar"}
"chkoun ma rj3ch" → {"action":"get_overdue","data":{},"lang":"darija"}
"fin homa les retours d'aujourd'hui" → {"action":"get_upcoming","data":{"days":1},"lang":"fr"}
"tcherch liya client Hassan" → {"action":"find_client","data":{"query":"Hassan"},"lang":"darija"}
"zid client Mohamed Benali 0661234567 AB123456" → {"action":"add_client","data":{"firstName":"Mohamed","lastName":"Benali","phone":"0661234567","cin":"AB123456","email":null},"lang":"darija"}
"find car A-45678-B" → {"action":"find_car","data":{"query":"A-45678-B"},"lang":"en"}
"chkoun makhlass mazal" → {"action":"get_pending_payments","data":{},"lang":"darija"}
"kif kayn l7al" → {"action":"get_stats_summary","data":{},"lang":"darija"}`;

// ── OpenAI call (native https, no SDK) ────────────
async function callOpenAI(message: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const body = JSON.stringify({
    model:           'gpt-4o-mini',
    messages:        [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: message },
    ],
    temperature:     0,
    max_tokens:      300,
    response_format: { type: 'json_object' },
  });

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'api.openai.com',
      path:     '/v1/chat/completions',
      method:   'POST',
      headers:  {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
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
          } catch (e) {
            reject(new Error('OpenAI parse error'));
          }
        } else {
          reject(new Error(`OpenAI HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Fallback rule-based parser (no AI) ────────────
function fallbackParse(message: string): ParsedCommand {
  const m = message.toLowerCase();

  const lang: AILang =
    /[\u0600-\u06FF]/.test(message) && /ديال|هاد|واش|كيف/.test(m) ? 'darija' :
    /[\u0600-\u06FF]/.test(message) ? 'ar' :
    /rapport|voiture|réservation|revenu|client/.test(m)            ? 'fr'     : 'en';

  const period =
    /اليوم|today|aujourd.hui/.test(m) ? 'today' :
    /الأسبوع|week|semaine/.test(m)    ? 'week'  :
    /السنة|year|année/.test(m)        ? 'year'  : 'month';

  if (/résumé|summary|kif kayn|كيف الحال|overview|l7al|الحال/.test(m))
    return { action: 'get_stats_summary', data: {}, lang };
  if (/retard|makhlass|ma rj3ch|marachoch|متأخر|overdue|pas rendu/.test(m))
    return { action: 'get_overdue',       data: {}, lang };
  if (/prochain retour|upcoming|ghadi iraj3|rj3o f|retours d.aujourd/.test(m))
    return { action: 'get_upcoming',      data: { days: 3 }, lang };
  if (/en attente|paiement|pending payment|makhlass/.test(m))
    return { action: 'get_pending_payments', data: {}, lang };
  if (/rapport|تقرير|report|dashboard/.test(m) && !/revenue|revenu|ربح/.test(m))
    return { action: 'get_report',        data: { period }, lang };
  if (/revenu|revenue|ربح|مداخيل|chiffre/.test(m))
    return { action: 'get_revenue',       data: { period }, lang };
  if (/réservation|reservation|ريزرفاسيون|حجز/.test(m))
    return { action: 'get_reservations',  data: { period, status: null }, lang };
  if (/matricul|plaque|immatricul|لوحة/.test(m)) {
    // Extract specific car model/brand after "dyal/de/of/ديال"
    const specificMatch = message.match(/(?:dyal|de |of |ديال\s*)\s*([A-Za-zÀ-ÿ\u0600-\u06FF][A-Za-zÀ-ÿ\u0600-\u06FF\s-]{1,20})/i);
    const query = specificMatch ? specificMatch[1].trim() : null;
    return { action: 'get_plates', data: { status: null, query }, lang };
  }
  if (/maintenance|entretien|révision|vidange|9rib|قريب الصيانة/.test(m))
    return { action: 'get_maintenance_due', data: { days: 30 }, lang };
  if (/tcherch.*client|find.*client|cherch.*client|بحث.*عميل/.test(m))
    return { action: 'find_client',       data: { query: m.replace(/tcherch|find|cherch|client|لي|بحث|عميل/g, '').trim() }, lang };
  if (/zid.*client|add.*client|ajouter.*client|زيد.*عميل/.test(m))
    return { action: 'add_client',        data: {}, lang };
  if (/tcherch.*voiture|find.*car|cherch.*voiture|بحث.*سيارة/.test(m))
    return { action: 'find_car',          data: { query: m.replace(/tcherch|find|cherch|voiture|car|سيارة|بحث/g, '').trim() }, lang };
  if (/voiture|car|véhicule|سيارة|parc|tomobil/.test(m)) {
    const carStatus =
      /disponible|available|libre|متاح|7or|حر|dispo/.test(m) ? 'AVAILABLE' :
      /location|rented|loué|مستأجر|ta7t|en cours/.test(m)   ? 'RENTED'    :
      /maintenance|entretien|révision/.test(m)               ? 'MAINTENANCE' : null;
    return { action: 'get_cars', data: { status: carStatus, query: null }, lang };
  }
  if (/client|عميل|customer/.test(m))
    return { action: 'get_clients',       data: {}, lang };

  return { action: 'unknown', data: {}, lang };
}

// ── Public API ─────────────────────────────────────
export async function parseAICommand(message: string): Promise<ParsedCommand> {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackParse(message);
  }
  try {
    const raw = await callOpenAI(message);
    const cmd = JSON.parse(raw) as ParsedCommand;
    // Validate structure
    if (!cmd.action || !cmd.data) throw new Error('Invalid command structure');
    return cmd;
  } catch (err) {
    console.warn('[AI] OpenAI failed, using fallback:', (err as Error).message);
    return fallbackParse(message);
  }
}
