import type { APIRoute } from 'astro';
import { logEvent } from '../../lib/log';

export const prerender = false;

// UUID v4 format: 8-4-4-4-12 hex, with version nibble = 4 and
// variant nibble in [8-b]. Strict regex below rejects garbage
// tokens at the edge before touching D1.
const TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type ConfirmOutcome =
  | 'confirmed'
  | 'already-confirmed'
  | 'invalid-token'
  | 'db-error'
  | 'no-binding';

export const GET: APIRoute = async ({ url, redirect, locals }) => {
  const token = (url.searchParams.get('token') ?? '').toLowerCase();

  if (!TOKEN_RE.test(token)) {
    logEvent('confirm.invalid_token');
    return redirect('/products?signup=invalid_token', 303);
  }

  const db = locals.runtime?.env?.DB;
  const outcome = await confirmToken(db, token);

  logEvent(`confirm.${outcome}`);

  if (outcome === 'confirmed' || outcome === 'no-binding') {
    // no-binding is dev/preview — pretend success so the UX
    // is exercisable without D1 bound. Same graceful-degrade
    // pattern as insertSignup on the signup side.
    return redirect('/products?signup=confirmed', 303);
  }
  if (outcome === 'already-confirmed') {
    // Idempotent: reclicking the link lands on the same
    // success state. The user doesn't see a different page.
    return redirect('/products?signup=confirmed', 303);
  }
  // 'invalid-token' = token wasn't in D1 at all
  // 'db-error' = DB threw
  return redirect('/products?signup=invalid_token', 303);
};

/**
 * Mark the row bound to this token as confirmed. Returns a
 * tagged outcome for the caller + the structured logger.
 */
async function confirmToken(
  db: D1Database | undefined,
  token: string,
): Promise<ConfirmOutcome> {
  if (!db) return 'no-binding';
  try {
    // UPDATE only flips confirmed_at for rows that are not
    // already confirmed. After the update, we check whether
    // the token even exists to distinguish invalid-token
    // from already-confirmed.
    const update = await db
      .prepare(
        'UPDATE signups ' +
          'SET confirmed_at = unixepoch() ' +
          'WHERE confirmation_token = ? ' +
          '  AND confirmed_at IS NULL',
      )
      .bind(token)
      .run();
    const changes = update.meta?.changes ?? 0;
    if (changes > 0) return 'confirmed';

    // 0 changes — either no row with this token, or the row
    // exists but is already confirmed. Distinguish via a
    // lookup.
    const lookup = await db
      .prepare(
        'SELECT 1 FROM signups WHERE confirmation_token = ? LIMIT 1',
      )
      .bind(token)
      .run();
    const exists = (lookup.meta?.changes ?? 0) > 0
      || ((lookup as unknown as { results?: unknown[] }).results?.length ?? 0) > 0;
    return exists ? 'already-confirmed' : 'invalid-token';
  } catch {
    return 'db-error';
  }
}
