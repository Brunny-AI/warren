import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '../src/pages/api/admin/signup-stats';

interface MockRow {
  readonly n?: number;
  readonly source?: string;
}

function makeDb(opts: {
  total?: number;
  confirmed?: number;
  pendingOver24h?: number;
  bySource?: ReadonlyArray<{ source: string; n: number }>;
  throws?: boolean;
}): D1Database {
  let call = 0;
  const run = vi.fn(async () => {
    if (opts.throws) throw new Error('d1 unavailable');
    call += 1;
    // Query order in computeStats: total → confirmed →
    // pendingOver24h → bySource
    if (call === 1) {
      return {
        results: [{ n: opts.total ?? 0 } as MockRow],
        meta: { changes: 0 },
      };
    }
    if (call === 2) {
      return {
        results: [{ n: opts.confirmed ?? 0 } as MockRow],
        meta: { changes: 0 },
      };
    }
    if (call === 3) {
      return {
        results: [{ n: opts.pendingOver24h ?? 0 } as MockRow],
        meta: { changes: 0 },
      };
    }
    return {
      results: (opts.bySource ?? []) as MockRow[],
      meta: { changes: 0 },
    };
  });
  const bind = vi.fn(() => ({ run }));
  // prepare() returns an object that supports BOTH bind()->run()
  // and .run() directly (for parameter-less queries) — matches
  // real D1 behavior.
  const prepare = vi.fn(() => ({ bind, run })) as unknown as
    D1Database['prepare'];
  return { prepare } as unknown as D1Database;
}

interface CallOpts {
  adminToken?: string;
  authHeader?: string;
  db?: D1Database;
}

async function callGet(opts: CallOpts = {}): Promise<Response> {
  const headers = new Headers();
  if (opts.authHeader !== undefined) {
    headers.set('authorization', opts.authHeader);
  }
  const request = new Request(
    'http://localhost/api/admin/signup-stats',
    { method: 'GET', headers },
  );

  const locals = {
    runtime: {
      env: {
        DB: opts.db as unknown as D1Database,
        ADMIN_TOKEN: opts.adminToken,
      },
      ctx: { waitUntil: vi.fn() },
    },
  };

  const ctx = {
    request,
    locals,
  } as unknown as Parameters<typeof GET>[0];

  return GET(ctx);
}

describe('GET /api/admin/signup-stats', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('provisioning guards', () => {
    it('returns 503 when ADMIN_TOKEN is not set', async () => {
      const db = makeDb({});
      const res = await callGet({ db, authHeader: 'Bearer x' });
      expect(res.status).toBe(503);
    });

    it('returns 503 when DB binding is absent', async () => {
      const res = await callGet({
        adminToken: 'secret',
        authHeader: 'Bearer secret',
      });
      expect(res.status).toBe(503);
    });
  });

  describe('auth', () => {
    it('returns 401 on missing Authorization header', async () => {
      const db = makeDb({});
      const res = await callGet({ adminToken: 'secret', db });
      expect(res.status).toBe(401);
    });

    it('returns 401 on Bearer token mismatch', async () => {
      const db = makeDb({});
      const res = await callGet({
        adminToken: 'secret',
        authHeader: 'Bearer wrong',
        db,
      });
      expect(res.status).toBe(401);
    });

    it('returns 401 when Authorization uses different scheme', async () => {
      const db = makeDb({});
      const res = await callGet({
        adminToken: 'secret',
        authHeader: 'Basic secret',
        db,
      });
      expect(res.status).toBe(401);
    });

    it('returns 200 on correct Bearer token', async () => {
      const db = makeDb({ total: 5, confirmed: 3 });
      const res = await callGet({
        adminToken: 'secret',
        authHeader: 'Bearer secret',
        db,
      });
      expect(res.status).toBe(200);
    });
  });

  describe('stats shape', () => {
    it('returns total + confirmed + pending_confirm + pending_over_24h + by_source', async () => {
      const db = makeDb({
        total: 10,
        confirmed: 7,
        pendingOver24h: 1,
        bySource: [
          { source: 'products', n: 6 },
          { source: 'contact', n: 4 },
        ],
      });
      const res = await callGet({
        adminToken: 'secret',
        authHeader: 'Bearer secret',
        db,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        total: 10,
        confirmed: 7,
        pending_confirm: 3,
        pending_over_24h: 1,
        by_source: { products: 6, contact: 4 },
      });
    });

    it('handles empty DB (zero signups)', async () => {
      const db = makeDb({ total: 0, confirmed: 0, pendingOver24h: 0 });
      const res = await callGet({
        adminToken: 'secret',
        authHeader: 'Bearer secret',
        db,
      });
      const body = await res.json();
      expect(body).toEqual({
        total: 0,
        confirmed: 0,
        pending_confirm: 0,
        pending_over_24h: 0,
        by_source: {},
      });
    });

    it('pending_over_24h is zero when all signups are fresh', async () => {
      const db = makeDb({
        total: 5,
        confirmed: 2,
        pendingOver24h: 0,
      });
      const res = await callGet({
        adminToken: 'secret',
        authHeader: 'Bearer secret',
        db,
      });
      const body = (await res.json()) as { pending_over_24h: number };
      expect(body.pending_over_24h).toBe(0);
    });

    it('sets cache-control no-store', async () => {
      const db = makeDb({});
      const res = await callGet({
        adminToken: 'secret',
        authHeader: 'Bearer secret',
        db,
      });
      expect(res.headers.get('cache-control')).toBe('no-store');
    });
  });

  describe('db failure', () => {
    it('returns 500 when DB query throws', async () => {
      const db = makeDb({ throws: true });
      const res = await callGet({
        adminToken: 'secret',
        authHeader: 'Bearer secret',
        db,
      });
      expect(res.status).toBe(500);
    });
  });
});
