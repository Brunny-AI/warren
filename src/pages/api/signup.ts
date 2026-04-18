import type { APIRoute } from 'astro';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_URL = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 5_000;
const SOURCE_DEFAULT = 'products-page';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const mediaType = (request.headers.get('content-type') ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  const isJson = mediaType === 'application/json';
  const wantsHtml = !isJson;

  let raw: string | null = null;
  if (isJson) {
    try {
      const body = await request.json();
      if (typeof body === 'object' && body !== null) {
        const v = (body as Record<string, unknown>).email;
        if (typeof v === 'string') raw = v;
      }
    } catch {
      return json({ error: 'invalid json' }, 400);
    }
  } else {
    const form = await request.formData();
    const v = form.get('email');
    if (typeof v === 'string') raw = v;
  }

  const email = normalize(raw);
  if (!email) {
    return wantsHtml
      ? redirect('/products?signup=missing', 303)
      : json({ error: 'email required' }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return wantsHtml
      ? redirect('/products?signup=invalid', 303)
      : json({ error: 'invalid email format' }, 400);
  }

  const env = locals.runtime?.env;
  const ctx = locals.runtime?.ctx;

  const isNewSignup = await insertSignup(env?.DB, email);

  // Fire-and-forget confirmation email. Failure here never
  // fails the signup — D1 is the source of truth. Only send
  // on first insert; duplicate submits don't re-confirm.
  if (
    isNewSignup &&
    env?.RESEND_API_KEY &&
    env?.RESEND_FROM_ADDRESS
  ) {
    const send = sendConfirmation(
      env.RESEND_API_KEY,
      env.RESEND_FROM_ADDRESS,
      email,
    );
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(send);
    } else {
      // Local dev fallback: fire-and-forget without waitUntil
      void send.catch(() => {});
    }
  }

  return wantsHtml
    ? redirect('/products?signup=saved', 303)
    : json({ ok: true }, 200);
};

function normalize(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 254) return null;
  return trimmed;
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Insert email into `signups` with idempotency. Returns true
 * if a new row was inserted, false if duplicate or if DB
 * binding is unavailable (dev/preview).
 */
async function insertSignup(
  db: D1Database | undefined,
  email: string,
): Promise<boolean> {
  if (!db) return false;
  try {
    const result = await db
      .prepare(
        'INSERT OR IGNORE INTO signups (email, source) ' +
          'VALUES (?, ?)',
      )
      .bind(email, SOURCE_DEFAULT)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  } catch {
    // Don't leak DB errors to the user. Signup persists only
    // if DB insert succeeds; failure here degrades to a no-op
    // which the caller can monitor via D1 row counts vs.
    // submit counts. Follow-up PR adds structured metrics.
    return false;
  }
}

/**
 * Send a Resend confirmation email. Returns silently on any
 * failure — caller treats as best-effort and relies on D1
 * for persistence.
 */
async function sendConfirmation(
  apiKey: string,
  fromAddress: string,
  to: string,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    RESEND_TIMEOUT_MS,
  );
  try {
    await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject: 'you\'re on the list',
        text:
          'thanks — we\'ll email you one line when something ' +
          'ships. no drip campaign, no newsletter spam.\n\n' +
          '— brunny',
      }),
      signal: controller.signal,
    });
  } catch {
    // Swallow — best-effort send.
  } finally {
    clearTimeout(timer);
  }
}
