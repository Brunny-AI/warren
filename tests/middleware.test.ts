import { describe, it, expect, vi } from 'vitest';

import { onRequest } from '../src/middleware';

describe('security headers middleware', () => {
  function callMiddleware(
    initial?: Response,
  ): Promise<Response> {
    const next = vi.fn(async () => initial ?? new Response('ok'));
    return onRequest(
      {} as Parameters<typeof onRequest>[0],
      next as Parameters<typeof onRequest>[1],
    );
  }

  it('adds baseline security headers to a plain response', async () => {
    const res = await callMiddleware();
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    );
    const pp = res.headers.get('Permissions-Policy');
    expect(pp).toContain('camera=()');
    expect(pp).toContain('geolocation=()');
    expect(pp).toContain('microphone=()');
  });

  it('does not overwrite headers already set by an upstream handler', async () => {
    // Upstream handler deliberately allows same-origin
    // framing (e.g. a /preview route); middleware must
    // respect that choice.
    const upstream = new Response('ok', {
      headers: { 'X-Frame-Options': 'SAMEORIGIN' },
    });
    const res = await callMiddleware(upstream);
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    // Untouched headers still get added.
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('preserves upstream response body + status', async () => {
    const upstream = new Response('teapot', { status: 418 });
    const res = await callMiddleware(upstream);
    expect(res.status).toBe(418);
    expect(await res.text()).toBe('teapot');
  });
});
