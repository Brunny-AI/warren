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

  it('emits a Content-Security-Policy with required directives', async () => {
    const res = await callMiddleware();
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).not.toBeNull();
    // Each directive must be present with at least the
    // expected primary source.
    expect(csp).toMatch(/default-src[^;]+'self'/);
    expect(csp).toMatch(/script-src[^;]+'self'[^;]+'unsafe-inline'/);
    expect(csp).toMatch(/style-src[^;]+'self'[^;]+'unsafe-inline'/);
    expect(csp).toMatch(/img-src[^;]+'self'[^;]+data:/);
    expect(csp).toMatch(/connect-src[^;]+'self'/);
    expect(csp).toMatch(/form-action[^;]+'self'/);
    expect(csp).toMatch(/frame-ancestors[^;]+'none'/);
    expect(csp).toMatch(/object-src[^;]+'none'/);
    expect(csp).toMatch(/base-uri[^;]+'self'/);
  });

  it('CSP respects upstream override', async () => {
    // A route that legitimately needs to relax CSP (e.g.
    // documentation showing code samples from an external
    // source) must be able to set its own.
    const upstream = new Response('ok', {
      headers: {
        'Content-Security-Policy':
          "default-src 'self' https://trusted.example",
      },
    });
    const res = await callMiddleware(upstream);
    expect(res.headers.get('Content-Security-Policy')).toBe(
      "default-src 'self' https://trusted.example",
    );
  });
});
