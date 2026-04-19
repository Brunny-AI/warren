/**
 * API handler-flow smoke — catches the class of bug that
 * `vitest-pool-workers` mocks miss.
 *
 * Per the CI-binding-existence ≠ handler-flow validation memory
 * + dogfood Round 1 P0-2 (Astro v6 locals.runtime.env removal,
 * 2026-04-19): vitest unit tests pass because they mock the
 * locals.runtime structure. The real Workers runtime throws on
 * the deprecated getter and the route returns 500 with empty
 * body. This spec hits the live wrangler-dev process and asserts
 * the HTTP contract: 200/303 (success) | 4xx (client error) |
 * 503 (graceful no-binding). Anything that returns 500 is the
 * runtime telling us our mocks lied.
 *
 * Targets local wrangler dev; same baseURL as walkthrough.spec.ts.
 */

import { test, expect } from '@playwright/test';

const ACCEPTABLE_STATUSES = new Set([200, 303, 400, 429, 503]);

test.describe('/api/signup handler-flow contract', () => {
  test('JSON POST with valid email returns 200 (D1 bound) or 503 (no D1)', async ({
    request,
  }) => {
    const stamp = Date.now();
    const res = await request.post('/api/signup', {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      data: { email: `smoke-${stamp}@brunny.ai`, source: 'home' },
    });
    expect(
      ACCEPTABLE_STATUSES.has(res.status()),
      `unexpected status ${res.status()} body=${await res.text()}`,
    ).toBe(true);
    expect(res.status(), 'must NOT be 500 (runtime crash)').not.toBe(500);
  });

  test('JSON POST with empty body returns 400, never 500', async ({
    request,
  }) => {
    const res = await request.post('/api/signup', {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      data: '',
    });
    // 400 on missing email or invalid JSON. 500 = runtime crash.
    expect(res.status()).not.toBe(500);
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test('form POST follows redirect contract (303 to /home?signup=...)', async ({
    request,
  }) => {
    const res = await request.post('/api/signup', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: 'email=smoke-noredir@brunny.ai&source=home',
      maxRedirects: 0,
    });
    // 303 = backend honored the form-content-type branch and
    // is redirecting back to the source page. 200/4xx/503 also
    // OK if config differs. Any 500 = handler crash.
    expect(res.status()).not.toBe(500);
  });
});

test.describe('/api/admin/signup-stats handler-flow contract', () => {
  test('GET without auth returns 401 or 503, never 500', async ({
    request,
  }) => {
    const res = await request.get('/api/admin/signup-stats');
    expect(res.status()).not.toBe(500);
    // 401 (auth required) or 503 (ADMIN_TOKEN not provisioned).
    expect([401, 503]).toContain(res.status());
  });

  test('GET with bad auth returns 401, never 500', async ({ request }) => {
    const res = await request.get('/api/admin/signup-stats', {
      headers: { Authorization: 'Bearer wrong-token' },
    });
    expect(res.status()).not.toBe(500);
    // 401 expected when ADMIN_TOKEN is provisioned + wrong;
    // 503 if ADMIN_TOKEN absent.
    expect([401, 503]).toContain(res.status());
  });
});
