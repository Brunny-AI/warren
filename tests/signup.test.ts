/**
 * Integration tests for POST /api/signup.
 *
 * The handler is exported from src/pages/api/signup.ts and
 * invoked directly with a synthesized APIContext. We don't
 * mount an Astro dev server — the handler only touches
 * `request`, `redirect`, and `locals.runtime.{env,ctx}`,
 * all of which are straightforward to stub.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '../src/pages/api/signup';

// ---------- helpers ---------------------------------------------------------

interface MockDbResult {
  meta?: { changes?: number };
}

function makeDb(opts: {
  changes?: number;
  throws?: boolean;
}): D1Database {
  const run = vi.fn(async (): Promise<MockDbResult> => {
    if (opts.throws) throw new Error('d1 unavailable');
    return { meta: { changes: opts.changes ?? 1 } };
  });
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind })) as unknown as
    D1Database['prepare'];
  return { prepare } as unknown as D1Database;
}

function makeKv(opts: { countAtKey?: number; throws?: boolean }): KVNamespace {
  const get = vi.fn(async () => {
    if (opts.throws) throw new Error('kv unavailable');
    return opts.countAtKey !== undefined
      ? String(opts.countAtKey)
      : null;
  });
  const put = vi.fn(async () => {});
  return { get, put } as unknown as KVNamespace;
}

interface CallOpts {
  body?: unknown;
  contentType?: string;
  form?: Record<string, string>;
  db?: D1Database;
  kv?: KVNamespace;
  resendKey?: string;
  resendFrom?: string;
  headers?: Record<string, string>;
}

async function callPost(opts: CallOpts = {}): Promise<{
  response: Response;
  redirectSpy: ReturnType<typeof vi.fn>;
}> {
  const headers = new Headers({
    'content-type': opts.contentType ?? 'application/json',
    ...(opts.headers ?? {}),
  });
  const init: RequestInit = { method: 'POST', headers };
  if (opts.form !== undefined) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(opts.form)) fd.set(k, v);
    init.body = fd;
    // Let fetch / Request infer the multipart boundary
    headers.delete('content-type');
  } else if (opts.body !== undefined) {
    init.body =
      typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }

  const request = new Request('http://localhost/api/signup', init);

  // redirect() on Astro APIContext returns a Response. Mirror the shape.
  const redirectSpy = vi.fn((url: string, status = 302) => {
    return new Response(null, { status, headers: { location: url } });
  });

  // Astro v6: handler reads `env` from cloudflare:workers (mocked
  // via vitest.setup.ts → globalThis.__mockEnv) instead of
  // locals.runtime.env. ctx (waitUntil) moved to locals.cfContext.
  globalThis.__mockEnv = {
    DB: opts.db as unknown as D1Database,
    RATE_LIMIT: opts.kv,
    RESEND_API_KEY: opts.resendKey,
    RESEND_FROM_ADDRESS: opts.resendFrom,
  };

  const ctx = {
    request,
    redirect: redirectSpy,
    locals: { cfContext: { waitUntil: vi.fn() } },
  } as unknown as Parameters<typeof POST>[0];

  const response = await POST(ctx);
  return { response, redirectSpy };
}

// ---------- suites ----------------------------------------------------------

describe('POST /api/signup — validation', () => {
  it('rejects invalid JSON body', async () => {
    const { response } = await callPost({ body: '{not-valid' });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('invalid json');
  });

  it('returns 400 when email is missing (JSON)', async () => {
    const { response } = await callPost({ body: {} });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('email required');
  });

  it('returns 400 when email is malformed (JSON)', async () => {
    const { response } = await callPost({ body: { email: 'no-at-sign' } });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('invalid email format');
  });
});

describe('POST /api/signup — success paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns {ok: true} on valid JSON submission without DB binding', async () => {
    const { response } = await callPost({ body: { email: 'a@b.co' } });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('returns {ok: true} when D1 reports a new row', async () => {
    const db = makeDb({ changes: 1 });
    const { response } = await callPost({
      body: { email: 'a@b.co' },
      db,
    });
    expect(response.status).toBe(200);
  });

  it('returns {ok: true} when D1 reports a duplicate (changes=0)', async () => {
    const db = makeDb({ changes: 0 });
    const { response } = await callPost({
      body: { email: 'a@b.co' },
      db,
    });
    expect(response.status).toBe(200);
  });

  it('returns 500 when D1 throws (honest failure)', async () => {
    const db = makeDb({ throws: true });
    const { response } = await callPost({
      body: { email: 'a@b.co' },
      db,
    });
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('signup failed. try again?');
  });
});

describe('POST /api/signup — source-aware redirect', () => {
  it('redirects to /products by default for no-JS form submits', async () => {
    const { redirectSpy } = await callPost({
      contentType: 'application/x-www-form-urlencoded',
      form: { email: 'a@b.co' },
    });
    expect(redirectSpy).toHaveBeenCalledWith(
      '/products?signup=saved',
      303,
    );
  });

  it('redirects to /contact when source=contact', async () => {
    const { redirectSpy } = await callPost({
      contentType: 'application/x-www-form-urlencoded',
      form: { email: 'a@b.co', source: 'contact' },
    });
    expect(redirectSpy).toHaveBeenCalledWith(
      '/contact?signup=saved',
      303,
    );
  });

  it('coerces unknown source values to "products"', async () => {
    const { redirectSpy } = await callPost({
      contentType: 'application/x-www-form-urlencoded',
      form: { email: 'a@b.co', source: 'https://evil.com' },
    });
    expect(redirectSpy).toHaveBeenCalledWith(
      '/products?signup=saved',
      303,
    );
  });

  it('source-aware redirect also applies to error statuses', async () => {
    const { redirectSpy } = await callPost({
      contentType: 'application/x-www-form-urlencoded',
      form: { email: 'not-valid', source: 'contact' },
    });
    expect(redirectSpy).toHaveBeenCalledWith(
      '/contact?signup=invalid',
      303,
    );
  });
});

describe('POST /api/signup — rate limiting', () => {
  it('allows when KV binding is absent (graceful degrade)', async () => {
    const { response } = await callPost({ body: { email: 'a@b.co' } });
    expect(response.status).toBe(200);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    // countAtKey=10 + this request = 11, > RATE_LIMIT_MAX=10
    const kv = makeKv({ countAtKey: 10 });
    const { response } = await callPost({
      body: { email: 'a@b.co' },
      kv,
    });
    expect(response.status).toBe(429);
  });

  it('redirects to /<source>?signup=rate_limited on no-JS rate-limit', async () => {
    const kv = makeKv({ countAtKey: 10 });
    const { redirectSpy } = await callPost({
      contentType: 'application/x-www-form-urlencoded',
      form: { email: 'a@b.co', source: 'contact' },
      kv,
    });
    expect(redirectSpy).toHaveBeenCalledWith(
      '/contact?signup=rate_limited',
      303,
    );
  });

  it('fails open when KV throws (defense-in-depth, not strict)', async () => {
    const kv = makeKv({ throws: true });
    const { response } = await callPost({
      body: { email: 'a@b.co' },
      kv,
    });
    expect(response.status).toBe(200);
  });
});

describe('POST /api/signup — Resend', () => {
  it('does not call Resend when binding is absent', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockClear();
    const db = makeDb({ changes: 1 });
    await callPost({ body: { email: 'a@b.co' }, db });
    // No RESEND_API_KEY → send guarded out
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('does not call Resend on duplicate signups', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));
    fetchSpy.mockClear();
    const db = makeDb({ changes: 0 }); // duplicate
    await callPost({
      body: { email: 'a@b.co' },
      db,
      resendKey: 're_test',
      resendFrom: 'noreply@example.com',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('logs confirmation_skipped_no_resend_config when key absent on insert', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(
      () => undefined,
    );
    logSpy.mockClear();
    const db = makeDb({ changes: 1 });
    await callPost({ body: { email: 'a@b.co' }, db });
    const emitted = logSpy.mock.calls
      .map((c) => c[0] as string)
      .filter(
        (s) =>
          typeof s === 'string' &&
          s.includes('signup.confirmation_skipped_no_resend_config'),
      );
    expect(emitted.length).toBe(1);
    logSpy.mockRestore();
  });

  it('does NOT log confirmation_skipped on duplicate (only inserts)', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(
      () => undefined,
    );
    logSpy.mockClear();
    const db = makeDb({ changes: 0 }); // duplicate, not insert
    await callPost({ body: { email: 'a@b.co' }, db });
    const emitted = logSpy.mock.calls
      .map((c) => c[0] as string)
      .filter(
        (s) =>
          typeof s === 'string' &&
          s.includes('signup.confirmation_skipped_no_resend_config'),
      );
    expect(emitted.length).toBe(0);
    logSpy.mockRestore();
  });
});
