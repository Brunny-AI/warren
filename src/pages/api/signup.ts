import type { APIRoute } from 'astro';
import { isValidEmail, normalizeEmail } from '../../lib/email';
import { logEvent } from '../../lib/log';
import { checkRateLimit } from '../../lib/rate-limit';

export const prerender = false;

const RESEND_URL = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 5_000;

// Allowlisted source pages. Unknown values from the form are
// coerced to SOURCE_DEFAULT rather than trusted verbatim —
// prevents open-redirect via a forged hidden field, and keeps
// D1 `source` column bounded for downstream funnel queries.
const SOURCES = ['products', 'contact'] as const;
type Source = (typeof SOURCES)[number];
const SOURCE_DEFAULT: Source = 'products';

// Per-IP cap on signup attempts. Picked generous enough that a
// real human bouncing between /products and /contact forms plus
// occasional retries won't trip; tight enough that a scripted
// abuser gets stopped before filling the D1 table with garbage.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 3600; // 1 hour

type InsertOutcome = 'inserted' | 'duplicate' | 'error' | 'no-binding';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const mediaType = (request.headers.get('content-type') ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  const isJson = mediaType === 'application/json';
  const wantsHtml = !isJson;

  let raw: string | null = null;
  let rawSource: string | null = null;
  if (isJson) {
    try {
      const body = await request.json();
      if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        if (typeof b.email === 'string') raw = b.email;
        if (typeof b.source === 'string') rawSource = b.source;
      }
    } catch {
      return json({ error: 'invalid json' }, 400);
    }
  } else {
    const form = await request.formData();
    const v = form.get('email');
    if (typeof v === 'string') raw = v;
    const s = form.get('source');
    if (typeof s === 'string') rawSource = s;
  }

  const source: Source = pickSource(rawSource);

  // Rate-limit per client IP AFTER body parse so the redirect
  // target can be source-aware. Body parse cost on a limited
  // request is negligible (< 1ms for a small JSON/form body),
  // and keeping UX consistent with the rest of the error paths
  // is worth it. Cloudflare sets cf-connecting-ip itself and
  // strips any client-supplied value, so it's trusted in this
  // runtime. Local dev / tests without the header key under
  // 'unknown' (still gives a bounded bucket).
  const env = locals.runtime?.env;
  const clientIp =
    request.headers.get('cf-connecting-ip') ?? 'unknown';
  const rl = await checkRateLimit(env?.RATE_LIMIT, {
    key: `signup:${clientIp}`,
    limit: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (!rl.allowed) {
    logEvent('signup.rate_limited', { source });
    return wantsHtml
      ? redirect(`/${source}?signup=rate_limited`, 303)
      : json(
          { error: 'too many signup attempts. try again in an hour.' },
          429,
        );
  }

  const email = normalizeEmail(raw);
  if (!email) {
    logEvent('signup.missing', { source });
    return wantsHtml
      ? redirect(`/${source}?signup=missing`, 303)
      : json({ error: 'email required' }, 400);
  }
  if (!isValidEmail(email)) {
    logEvent('signup.invalid', { source });
    return wantsHtml
      ? redirect(`/${source}?signup=invalid`, 303)
      : json({ error: 'invalid email format' }, 400);
  }

  const ctx = locals.runtime?.ctx;

  const { outcome, token } = await insertSignup(env?.DB, email, source);

  // Honest failure: don't pretend success on a real DB error.
  // 'no-binding' (dev/preview without DB) and 'duplicate' are
  // both treated as success — the user already exists or the
  // environment isn't wired for persistence yet.
  if (outcome === 'error') {
    logEvent('signup.db_error', { source });
    return wantsHtml
      ? redirect(`/${source}?signup=error`, 303)
      : json({ error: 'signup failed. try again?' }, 500);
  }

  logEvent(`signup.${outcome}`, { source });

  // Fire-and-forget confirmation email. Only send on first
  // insert — duplicates and no-binding skip the send. Failure
  // inside the send swallows; D1 is the source of truth.
  const siteOrigin = new URL(request.url).origin;
  if (
    outcome === 'inserted' &&
    token !== null &&
    env?.RESEND_API_KEY &&
    env?.RESEND_FROM_ADDRESS
  ) {
    const confirmUrl = `${siteOrigin}/api/confirm?token=${token}`;
    const send = sendConfirmation(
      env.RESEND_API_KEY,
      env.RESEND_FROM_ADDRESS,
      email,
      confirmUrl,
    );
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(send);
    } else {
      // Local dev fallback: fire-and-forget without waitUntil
      void send.catch(() => {});
    }
  } else if (outcome === 'inserted' && token !== null) {
    // Signup persisted but confirmation skipped — surface the
    // config gap so admin-stats pending_confirm climbing without
    // delivery can be distinguished from user-didn't-click-yet.
    // Quieter than a 500 (signup itself worked) but louder than
    // silence (previously returned 'inserted' with no trace of
    // the skipped send).
    logEvent('signup.confirmation_skipped_no_resend_config', {
      source,
    });
  }

  return wantsHtml
    ? redirect(`/${source}?signup=saved`, 303)
    : json({ ok: true }, 200);
};

function pickSource(raw: string | null): Source {
  if (raw !== null) {
    for (const s of SOURCES) {
      if (s === raw) return s;
    }
  }
  return SOURCE_DEFAULT;
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
  source: Source,
): Promise<{ outcome: InsertOutcome; token: string | null }> {
  if (!db) return { outcome: 'no-binding', token: null };
  try {
    const token = crypto.randomUUID();
    const result = await db
      .prepare(
        'INSERT OR IGNORE INTO signups ' +
          '(email, source, confirmation_token) ' +
          'VALUES (?, ?, ?)',
      )
      .bind(email, source, token)
      .run();
    const changes = result.meta?.changes ?? 0;
    // Token only meaningful when a NEW row was inserted. On
    // duplicate we return null — the caller should NOT send a
    // second confirmation email (original token is still
    // valid in D1 from the first insert).
    return {
      outcome: changes > 0 ? 'inserted' : 'duplicate',
      token: changes > 0 ? token : null,
    };
  } catch {
    return { outcome: 'error', token: null };
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
  confirmUrl: string,
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
        subject: 'confirm your signup',
        text:
          'one more step — click the link below to confirm ' +
          'your email:\n\n' +
          `${confirmUrl}\n\n` +
          "we'll only email you one line when something " +
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
