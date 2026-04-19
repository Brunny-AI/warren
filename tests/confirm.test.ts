/**
 * Tests for GET /api/confirm — email confirmation handler.
 *
 * Same APIContext-mocking pattern as signup.test.ts: stub
 * `locals.runtime.env.DB` with configurable update / lookup
 * return values, stub `redirect` as a vi.fn, assert on
 * redirect calls + response status.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '../src/pages/api/confirm';

function makeDb(opts: {
  updateChanges?: number;
  lookupHasRow?: boolean;
  throws?: boolean;
}): D1Database {
  let call = 0;
  const run = vi.fn(async () => {
    if (opts.throws) throw new Error('d1 unavailable');
    call += 1;
    if (call === 1) {
      // UPDATE call
      return { meta: { changes: opts.updateChanges ?? 0 } };
    }
    // SELECT lookup call
    const hasRow = opts.lookupHasRow ?? false;
    return { results: hasRow ? [{}] : [], meta: { changes: 0 } };
  });
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind })) as unknown as D1Database['prepare'];
  return { prepare } as unknown as D1Database;
}

interface CallOpts {
  token?: string;
  db?: D1Database;
}

async function callGet(opts: CallOpts = {}): Promise<{
  response: Response;
  redirectSpy: ReturnType<typeof vi.fn>;
}> {
  const url = new URL('http://localhost/api/confirm');
  if (opts.token !== undefined) {
    url.searchParams.set('token', opts.token);
  }

  const redirectSpy = vi.fn((target: string, status = 302) => {
    return new Response(null, {
      status,
      headers: { location: target },
    });
  });

  // Astro v6: handler reads `env` from cloudflare:workers (mocked
  // via vitest.setup.ts → globalThis.__mockEnv).
  globalThis.__mockEnv = { DB: opts.db as unknown as D1Database };

  const ctx = {
    url,
    redirect: redirectSpy,
    locals: {},
  } as unknown as Parameters<typeof GET>[0];

  const response = await GET(ctx);
  return { response, redirectSpy };
}

describe('GET /api/confirm', () => {
  const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('token validation', () => {
    it('redirects to invalid_token when no token param', async () => {
      const { redirectSpy } = await callGet({});
      expect(redirectSpy).toHaveBeenCalledWith(
        '/products?signup=invalid_token',
        303,
      );
    });

    it('redirects to invalid_token on empty token', async () => {
      const { redirectSpy } = await callGet({ token: '' });
      expect(redirectSpy).toHaveBeenCalledWith(
        '/products?signup=invalid_token',
        303,
      );
    });

    it('redirects to invalid_token on malformed token', async () => {
      const { redirectSpy } = await callGet({ token: 'not-a-uuid' });
      expect(redirectSpy).toHaveBeenCalledWith(
        '/products?signup=invalid_token',
        303,
      );
    });

    it('redirects to invalid_token on UUID with wrong version', async () => {
      // UUID v1 (time-based) — our scheme mints only v4
      const { redirectSpy } = await callGet({
        token: '550e8400-e29b-11d4-a716-446655440000',
      });
      expect(redirectSpy).toHaveBeenCalledWith(
        '/products?signup=invalid_token',
        303,
      );
    });

    it('accepts lowercase UUID v4', async () => {
      const db = makeDb({ updateChanges: 1 });
      const { redirectSpy } = await callGet({ token: VALID_UUID, db });
      expect(redirectSpy).toHaveBeenCalledWith(
        '/products?signup=confirmed',
        303,
      );
    });

    it('normalizes uppercase UUID v4 to lowercase', async () => {
      const db = makeDb({ updateChanges: 1 });
      const { redirectSpy } = await callGet({
        token: VALID_UUID.toUpperCase(),
        db,
      });
      expect(redirectSpy).toHaveBeenCalledWith(
        '/products?signup=confirmed',
        303,
      );
    });
  });

  describe('confirm outcomes', () => {
    it('fresh confirmation: UPDATE changes=1 → confirmed', async () => {
      const db = makeDb({ updateChanges: 1 });
      const { redirectSpy } = await callGet({ token: VALID_UUID, db });
      expect(redirectSpy).toHaveBeenCalledWith(
        '/products?signup=confirmed',
        303,
      );
    });

    it('already-confirmed: UPDATE changes=0 + lookup finds row → confirmed (idempotent)', async () => {
      const db = makeDb({
        updateChanges: 0,
        lookupHasRow: true,
      });
      const { redirectSpy } = await callGet({ token: VALID_UUID, db });
      expect(redirectSpy).toHaveBeenCalledWith(
        '/products?signup=confirmed',
        303,
      );
    });

    it('invalid token: UPDATE changes=0 + lookup empty → invalid_token', async () => {
      const db = makeDb({
        updateChanges: 0,
        lookupHasRow: false,
      });
      const { redirectSpy } = await callGet({ token: VALID_UUID, db });
      expect(redirectSpy).toHaveBeenCalledWith(
        '/products?signup=invalid_token',
        303,
      );
    });

    it('DB throws → invalid_token (fail-closed, not-exposing the error)', async () => {
      const db = makeDb({ throws: true });
      const { redirectSpy } = await callGet({ token: VALID_UUID, db });
      expect(redirectSpy).toHaveBeenCalledWith(
        '/products?signup=invalid_token',
        303,
      );
    });

    it('no DB binding (dev/preview) → confirmed (graceful degrade)', async () => {
      const { redirectSpy } = await callGet({ token: VALID_UUID });
      expect(redirectSpy).toHaveBeenCalledWith(
        '/products?signup=confirmed',
        303,
      );
    });
  });
});
