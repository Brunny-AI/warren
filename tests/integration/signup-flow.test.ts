/**
 * Harness smoke for the miniflare integration suite.
 *
 * Scope for this initial harness PR: verify miniflare boots
 * with the project's wrangler.toml, D1 + KV bindings resolve
 * inside the Workers runtime, and the vitest-pool-workers
 * plumbing is wired correctly. Direct handler invocation via
 * `SELF.fetch` requires `poolOptions.workers.main` pointing at
 * the Astro-generated Worker entrypoint (dist/server/entry.mjs
 * after build, OR @astrojs/cloudflare/entrypoints/server in
 * dev) — deferred to a follow-up PR so this one stays
 * dependency-free on `npm run build`.
 *
 * Run: `npx vitest run --project=integration`
 *
 * Future PRs on this harness:
 *   - Wire poolOptions.workers.main to the adapter entrypoint
 *   - Full signup → /api/confirm?token=... → /api/admin/signup-stats
 *   - Assert JSON shape + stats counters increment
 *   - Exercise rate-limit KV across repeated calls
 */
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('integration: harness smoke', () => {
  it('miniflare boots with DB binding', () => {
    // If this passes the runtime started, wrangler.toml parsed,
    // and D1 is reachable as a typed binding. Failure here
    // means the harness config is broken before any handler
    // gets a chance to run.
    expect(env.DB).toBeDefined();
  });

  it('miniflare boots with RATE_LIMIT binding', () => {
    // KV binding separately — it's on a different miniflare
    // plugin path than D1, so worth asserting independently
    // rather than collapsing into one test.
    expect(env.RATE_LIMIT).toBeDefined();
  });

  it('D1 prepare() is callable without throwing', () => {
    // Minimal liveness: the binding isn't just a stub, it
    // actually exposes the D1 API surface we use in handlers.
    // No actual query — just verifying prepare() exists.
    const stmt = env.DB.prepare('SELECT 1 AS x');
    expect(stmt).toBeDefined();
  });
});
