import * as https from 'https';

// ── Types ──────────────────────────────────────────
export interface ConversationMessage {
  role:    'user' | 'assistant';
  content: string;
}

// ── System prompt ──────────────────────────────────
const SYSTEM_PROMPT = `You are a helpful AI assistant built into "Kharrazi Fleet", a Moroccan car rental agency management SaaS.
You help agency staff (managers and employees) with their daily work.

About the system:
- Car fleet management: track cars (available / rented / maintenance), add/remove vehicles
- Client management: CIN, phone, email, rental history
- Reservations: start/end dates, pricing per day, deposit
- Payments: cash, card, bank transfer — track pending/paid/refunded
- Revenue reports: daily, weekly, monthly, yearly
- Maintenance tracking: next maintenance date, insurance expiry, technical visit expiry

For structured data queries, the user can ask things like:
- "kif kayn l7al" → overall dashboard summary
- "chkoun ma rj3ch" → overdue returns
- "véhicules disponibles" → available cars
- "revenus de ce mois" → monthly revenue
- "chkoun makhlass mazal" → pending payments
- "tomobilat li 9rib lihom maintenance" → cars needing maintenance soon

Your role in free conversation:
- Answer general questions about car rental business practices
- Help with price calculations (e.g. "3 days x 350 dh = 1050 dh + deposit")
- Explain how features of the system work
- Give advice and tips about managing a rental agency
- Be friendly, concise, and professional

Language: Respond naturally in the same language the user writes in.
- Darija (Moroccan Arabic dialect) → reply in Darija
- Arabic → reply in Arabic
- French → reply in French
- English → reply in English
- Mixed → follow the dominant language

Format: Use **bold** for important numbers or key info. Keep responses short and practical.`;

// ── Groq API call (native https, no SDK needed) ────
async function callGroq(messages: { role: string; content: string }[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY!;

  const body = JSON.stringify({
    model:       'llama-3.3-70b-versatile',
    messages:    [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    temperature: 0.7,
    max_tokens:  1024,
  });

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'api.groq.com',
      path:     '/openai/v1/chat/completions',
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
            reject(new Error('Groq parse error'));
          }
        } else {
          reject(new Error(`Groq HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Main function ──────────────────────────────────
export async function askClaude(
  message: string,
  history: ConversationMessage[] = [],
): Promise<string> {
  const messages = [
    ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  return callGroq(messages);
}
