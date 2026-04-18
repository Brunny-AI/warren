import type { APIRoute } from 'astro';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_URL = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 5_000;
const SOURCE_DEFAULT = 'products-page';

type InsertOutcome = 'inserted' | 'duplicate' | 'error' | 'no-binding';

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

  const outcome = await insertSignup(env?.DB, email);

  // Honest failure: don't pretend success on a real DB error.
  // 'no-binding' (dev/preview without DB) and 'duplicate' are
  // both treated as success — the user already exists or the
  // environment isn't wired for persistence yet.
  if (outcome === 'error') {
    return wantsHtml
      ? redirect('/products?signup=error', 303)
      : json({ error: 'signup failed. try again?' }, 500);
  }

  // Fire-and-forget confirmation email. Only send on first
  // insert — duplicates and no-binding skip the send. Failure
  // inside the send swallows; D1 is the source of truth.
  if (
    outcome === 'inserted' &&
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
 * Insert email into `signups` with idempotency. Returns a
 * tagged outcome so the caller can distinguish:
 *   - 'inserted'   — new row written; send confirmation
 *   - 'duplicate'  — email already present; skip confirmation
 *   - 'error'      — DB threw; caller should fail the request
 *   - 'no-binding' — no DB bound (dev / preview); treat as soft-success
 * Collapsing these into boolean hid the error case behind a
 * "silent drop on unprovisioned deploy" footgun (per review
 * on 2026-04-18).
 */
async function insertSignup(
  db: D1Database | undefined,
  email: string,
): Promise<InsertOutcome> {
  if (!db) return 'no-binding';
  try {
    const result = await db
      .prepare(
        'INSERT OR IGNORE INTO signups (email, source) ' +
          'VALUES (?, ?)',
      )
      .bind(email, SOURCE_DEFAULT)
      .run();
    const changes = result.meta?.changes ?? 0;
    return changes > 0 ? 'inserted' : 'duplicate';
  } catch {
    return 'error';
  }
}

/**
 * Send a Resend confirmation email. Returns silently on any
 * failure — caller treats as best-effort and relies on D1
 * for persistence. A non-2xx response is an explicit failure;
 * we raise it into the catch path so it's treated the same
 * as a network/abort failure (vs. silently treating 4xx/5xx
 * as success).
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
    const res = await fetch(RESEND_URL, {
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
    if (!res.ok) {
      throw new Error(`resend ${res.status}`);
    }
  } catch {
    // Swallow — best-effort send. Failure path is identical
    // whether caused by network, abort, or !res.ok.
  } finally {
    clearTimeout(timer);
  }
}
