/**
 * Fixed-window per-key rate limiter backed by Cloudflare KV.
 *
 * Shape chosen for simplicity + Workers KV semantics:
 *   - Fixed window, not sliding — KV's eventual consistency
 *     makes sliding-window atomics risky for the small savings
 *     they deliver at our scale.
 *   - Per-key is whatever the caller chooses (IP, email,
 *     email+route, etc.). Stable across the window.
 *   - Exceedance counts beyond the limit still increment,
 *     so burst size is observable via the returned `count`.
 *
 * Not MVP-scoped but cheap to add now:
 *   - Cluster-wide consistency: eventually-consistent. A burst
 *     that fans out across Cloudflare POPs can exceed the
 *     nominal limit by a constant multiple before KV
 *     propagates. Acceptable for abuse-prevention; not
 *     acceptable for strict quota enforcement.
 */

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly count: number;
  readonly limit: number;
  readonly resetAt: number; // epoch seconds when window ends
}

/**
 * Minimal KV surface we consume. Matches the subset of
 * Cloudflare KVNamespace needed for a fixed-window counter.
 */
export interface KVStore {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

export interface CheckOptions {
  /** Caller-provided identity (IP, email, email+route, etc.) */
  readonly key: string;
  /** Max requests allowed per window */
  readonly limit: number;
  /** Window size in seconds (also the KV TTL) */
  readonly windowSeconds: number;
  /** Optional override for `now()` — tests inject a fixed clock */
  readonly now?: () => number;
}

/**
 * Check + increment the per-key counter. Returns {allowed,
 * count, limit, resetAt}. Caller decides what to do with a
 * disallowed result (429, redirect, silent drop).
 *
 * If `kv` is undefined (dev/preview without KV bound), this
 * degrades to allow-all — consistent with the "graceful
 * degrade on missing binding" pattern in signup.ts.
 */
export async function checkRateLimit(
  kv: KVStore | undefined,
  options: CheckOptions,
): Promise<RateLimitResult> {
  const now = (options.now ?? defaultNow)();
  const windowStart =
    Math.floor(now / options.windowSeconds) * options.windowSeconds;
  const resetAt = windowStart + options.windowSeconds;
  const windowKey = `${options.key}:${windowStart}`;

  if (!kv) {
    // No binding — allow all. Observable behaviour: the caller
    // should still treat the route as rate-limit-eligible in
    // production (binding must be present), but dev/preview
    // doesn't need it.
    return {
      allowed: true,
      count: 0,
      limit: options.limit,
      resetAt,
    };
  }

  // Fail-open on KV errors. Rate limiting is a defense-in-depth
  // layer; an outage of the counter store should not take down
  // the protected route. The caller can layer stricter policy
  // on top if a zero-trust stance is required.
  try {
    const raw = await kv.get(windowKey);
    const prior = parseCount(raw);
    const next = prior + 1;

    // Write before the return so the next caller sees the bump.
    // Note: KV.put is eventually consistent — bursts across
    // POPs can overshoot by a constant factor before the write
    // propagates. For abuse prevention this is fine.
    await kv.put(windowKey, String(next), {
      expirationTtl: Math.max(options.windowSeconds, 60),
    });

    return {
      allowed: next <= options.limit,
      count: next,
      limit: options.limit,
      resetAt,
    };
  } catch {
    return {
      allowed: true,
      count: 0,
      limit: options.limit,
      resetAt,
    };
  }
}

function parseCount(raw: string | null): number {
  if (raw === null) return 0;
  const n = Number.parseInt(raw, 10);
  // Defensive: KV could hold garbage from a prior key collision
  // or a bad migration. Treat non-numeric as zero and let the
  // window reset naturally.
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function defaultNow(): number {
  return Math.floor(Date.now() / 1000);
}
