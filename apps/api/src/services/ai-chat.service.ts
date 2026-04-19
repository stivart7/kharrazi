import * as https from 'https';
import { AILang } from './ai-command-parser.service';

const SYSTEM_PROMPT = `You are a helpful assistant for a Moroccan car rental agency (SaaS platform, currency: MAD).
Answer questions about: reservations, cars, pricing, clients, availability, revenue.
Rules:
- Respond in the SAME language as the user (Darija / Arabic / French / English)
- Keep responses SHORT and DIRECT (2-4 sentences max)
- Be practical — give actionable answers
- If you don't know, say so honestly`;

// ── Single OpenAI call with timeout ───────────
function callOpenAI(message: string, context?: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const userContent = context
    ? `Context: ${context}\n\nQuestion: ${message}`
    : message;

  const body = JSON.stringify({
    model:       'gpt-4o-mini',
    messages:    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userContent },
    ],
    temperature: 0.5,
    max_tokens:  200,
  });

  const requestPromise = new Promise<string>((resolve, reject) => {
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
            resolve(parsed.choices[0].message.content as string);
          } catch {
            reject(new Error('Parse error'));
          }
        } else if (res.statusCode === 429) {
          reject(new Error('QUOTA_EXCEEDED'));
        } else if (res.statusCode === 401) {
          reject(new Error('INVALID_KEY'));
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), 10_000)
  );

  return Promise.race([requestPromise, timeoutPromise]);
}

// ── Public: call with 1 retry on failure ──────
export async function askAI(
  message: string,
  lang: AILang,
  context?: string,
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    const msgs: Record<AILang, string> = {
      darija: '❓ ما عرفتش نجاوبك على هاد السؤال.',
      ar:     '❓ لم أتمكن من الإجابة على هذا السؤال.',
      fr:     '❓ Je n\'ai pas pu répondre à cette question.',
      en:     '❓ I couldn\'t answer this question.',
    };
    return msgs[lang] ?? msgs.fr;
  }

  try {
    return await callOpenAI(message, context);
  } catch (err) {
    const errMsg = (err as Error).message;

    // Quota / key errors — no point retrying
    if (errMsg === 'QUOTA_EXCEEDED') {
      const msgs: Record<AILang, string> = {
        darija: '⚠️ *Quota OpenAI kaml* — account dyalek ma3ndouch crédits. Dkhl platform.openai.com/billing tzid crédits.',
        ar:     '⚠️ *تم استنفاد حصة OpenAI* — أضف رصيداً في platform.openai.com/billing.',
        fr:     '⚠️ *Quota OpenAI épuisé* — Ajoutez des crédits sur platform.openai.com/billing.',
        en:     '⚠️ *OpenAI quota exceeded* — Add credits at platform.openai.com/billing.',
      };
      return msgs[lang] ?? msgs.fr;
    }
    if (errMsg === 'INVALID_KEY') {
      const msgs: Record<AILang, string> = {
        darija: '⚠️ API Key OpenAI machi valid. Chk liy had lkey f .env.',
        ar:     '⚠️ مفتاح OpenAI غير صالح. تحقق من الإعدادات.',
        fr:     '⚠️ Clé API OpenAI invalide. Vérifiez la configuration.',
        en:     '⚠️ Invalid OpenAI API key. Check your configuration.',
      };
      return msgs[lang] ?? msgs.fr;
    }

    // Retry once for transient errors (timeout, network)
    try {
      return await callOpenAI(message, context);
    } catch {
      const errMsgs: Record<AILang, string> = {
        darija: '⚠️ مقدرتش نجاوبك دابا. عاود حاول من بعد شوية.',
        ar:     '⚠️ لم أتمكن من الرد الآن. حاول مرة أخرى.',
        fr:     '⚠️ Impossible de répondre maintenant. Réessayez.',
        en:     '⚠️ Unable to respond right now. Please try again.',
      };
      return errMsgs[lang] ?? errMsgs.fr;
    }
  }
}
