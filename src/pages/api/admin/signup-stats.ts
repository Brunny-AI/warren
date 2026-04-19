import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Internal admin endpoint returning signup funnel counts.
 *
 * Auth: requires \`Authorization: Bearer <ADMIN_TOKEN>\` header.
 * The ADMIN_TOKEN secret is provisioned via
 * \`wrangler secret put ADMIN_TOKEN\` and is NOT the same as
 * the Resend API key. Single shared secret is sufficient for
 * a team of 4 with read-only access; multi-user auth is v2.
 *
 * Returns JSON:
 *   {
 *     total: N,
 *     confirmed: N,
 *     pending_confirm: N,
 *     pending_over_24h: N,
 *     by_source: { products: N, contact: N, ... },
 *   }
 *
 * Graceful degrade: without a DB binding (dev/preview) OR
 * without ADMIN_TOKEN set, the endpoint returns 503 — callers
 * can't confuse "no data" with "zero signups." Auth failure
 * returns 401 without revealing whether the token was missing
 * vs wrong (timing-safe equality).
 */

interface StatsResult {
  readonly total: number;
  readonly confirmed: number;
  readonly pending_confirm: number;
  /**
   * Rows with a confirmation_token set + confirmed_at NULL +
   * created_at older than 24h. Signals a stuck-in-funnel
   * segment: either a bad email delivery, a user who clicked
   * 'submit' but never got / never saw the Resend link, or
   * an abandoned signup. Count spiking is a monitor signal
   * worth an alert; steady small number is normal (humans
   * ignore confirm emails).
   */
  readonly pending_over_24h: number;
  /**
   * Unix epoch seconds of the most recent signup
   * (MAX(created_at)). Null if no signups exist yet.
   * Paired with pending_over_24h: if last_signup_at is
   * very fresh but pending_over_24h is climbing, the
   * problem is delivery, not traffic.
   */
  readonly last_signup_at: number | null;
  /**
   * Unix epoch seconds of the most recent confirmation
   * (MAX(confirmed_at)). Null if nothing's been confirmed
   * yet. Gap between last_signup_at and last_confirmed_at
   * approximates the confirm-click latency distribution.
   */
  readonly last_confirmed_at: number | null;
  readonly by_source: Readonly<Record<string, number>>;
}

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;

  // Service not provisioned — 503 is the honest answer.
  // Returning 200-with-zeros would let a caller think the
  // counts are real.
  if (!env?.ADMIN_TOKEN) {
    return json({ error: 'stats endpoint not provisioned' }, 503);
  }
  if (!env?.DB) {
    return json({ error: 'stats endpoint not provisioned' }, 503);
  }

  const auth = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${env.ADMIN_TOKEN}`;
  // Constant-time compare avoids a timing-leak of the token
  // prefix. The native === operator short-circuits on first
  // mismatch; \`timingSafeEqual\` doesn't.
  if (!timingSafeEqual(auth, expected)) {
    return json({ error: 'unauthorized' }, 401);
  }

  const stats = await computeStats(env.DB);
  if (stats === null) {
    return json({ error: 'stats query failed' }, 500);
  }
  return json(stats, 200);
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
      // Admin stats should never be CDN-cached; every call
      // is a point-in-time read.
      'cache-control': 'no-store',
    },
  });
}

/**
 * Length-safe, constant-time string equality. Returns false
 * without early-exit on first mismatched byte. Uses UTF-8
 * length as the loop bound so differing-length strings still
 * drain a bounded number of bytes before returning false.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Run the stats queries. Returns null on DB error so the
 * caller can distinguish provisioning problems from
 * transient DB failures.
 */
async function computeStats(
  db: D1Database,
): Promise<StatsResult | null> {
  try {
    const totalRes = await db
      .prepare('SELECT COUNT(*) AS n FROM signups')
      .run();
    const confirmedRes = await db
      .prepare(
        'SELECT COUNT(*) AS n FROM signups ' +
          'WHERE confirmed_at IS NOT NULL',
      )
      .run();
    // Pending-over-24h: rows that have a token + no confirm
    // + are older than a day. Filters out fresh signups in
    // the normal 0-24h confirm window. confirmation_token
    // filter excludes pre-#29 grandfathered rows.
    const pendingOver24hRes = await db
      .prepare(
        'SELECT COUNT(*) AS n FROM signups ' +
          'WHERE confirmed_at IS NULL ' +
          '  AND confirmation_token IS NOT NULL ' +
          '  AND created_at < unixepoch() - 86400',
      )
      .run();
    // Timestamp pairs. MAX() returns NULL when the table is
    // empty or the filtered subset is empty — we surface
    // that null upward rather than coercing to 0 (which a
    // consumer would misinterpret as 'happened at epoch').
    const lastSignupRes = await db
      .prepare('SELECT MAX(created_at) AS t FROM signups')
      .run();
    // SQLite MAX() ignores NULLs, so no WHERE filter needed —
    // MAX returns NULL if there are zero confirmed rows, which
    // firstT() below surfaces as null rather than coercing to 0.
    const lastConfirmedRes = await db
      .prepare('SELECT MAX(confirmed_at) AS t FROM signups')
      .run();
    const bySourceRes = await db
      .prepare(
        'SELECT source, COUNT(*) AS n FROM signups ' +
          'GROUP BY source',
      )
      .run();

    const total = firstN(totalRes);
    const confirmed = firstN(confirmedRes);
    const pendingOver24h = firstN(pendingOver24hRes);
    const lastSignupAt = firstT(lastSignupRes);
    const lastConfirmedAt = firstT(lastConfirmedRes);
    const bySource: Record<string, number> = {};
    const rows = ((bySourceRes as unknown) as {
      results?: { source?: string; n?: number }[];
    }).results ?? [];
    for (const r of rows) {
      if (typeof r.source === 'string' && typeof r.n === 'number') {
        bySource[r.source] = r.n;
      }
    }

    return {
      total,
      confirmed,
      pending_confirm: total - confirmed,
      pending_over_24h: pendingOver24h,
      last_signup_at: lastSignupAt,
      last_confirmed_at: lastConfirmedAt,
      by_source: bySource,
    };
  } catch {
    return null;
  }
}

/**
 * Extract a nullable timestamp from a MAX() query result.
 * Returns null if the table was empty (MAX returns NULL) —
 * NOT 0, which a consumer would misread as epoch 1970.
 */
function firstT(result: unknown): number | null {
  const r = result as { results?: { t?: number | null }[] };
  const t = r.results?.[0]?.t;
  return typeof t === 'number' ? t : null;
}

function firstN(result: unknown): number {
  const r = result as { results?: { n?: number }[] };
  const n = r.results?.[0]?.n;
  return typeof n === 'number' ? n : 0;
}
