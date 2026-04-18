import { describe, it, expect } from 'vitest';
import {
  checkRateLimit,
  type KVStore,
} from '../src/lib/rate-limit';

/** In-memory KV mock with deterministic semantics for tests. */
function mockKV(): KVStore & { dump(): Map<string, string> } {
  const store = new Map<string, string>();
  return {
    async get(key) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    dump() {
      return store;
    },
  };
}

const WINDOW = 60;
const LIMIT = 3;

describe('checkRateLimit', () => {
  it('allows up to the limit, disallows the (limit+1)th', async () => {
    const kv = mockKV();
    const now = () => 1000;
    const opts = { key: 'ip:1.2.3.4', limit: LIMIT, windowSeconds: WINDOW, now };

    const first = await checkRateLimit(kv, opts);
    expect(first).toEqual({ allowed: true, count: 1, limit: 3, resetAt: 1020 });

    const second = await checkRateLimit(kv, opts);
    expect(second.count).toBe(2);
    expect(second.allowed).toBe(true);

    const third = await checkRateLimit(kv, opts);
    expect(third.count).toBe(3);
    expect(third.allowed).toBe(true);

    const fourth = await checkRateLimit(kv, opts);
    expect(fourth.count).toBe(4);
    expect(fourth.allowed).toBe(false);
  });

  it('increments count even past the limit (burst observability)', async () => {
    const kv = mockKV();
    const now = () => 1000;
    const opts = { key: 'ip:1.2.3.4', limit: 1, windowSeconds: WINDOW, now };

    await checkRateLimit(kv, opts);
    const over1 = await checkRateLimit(kv, opts);
    const over2 = await checkRateLimit(kv, opts);

    expect(over1).toMatchObject({ allowed: false, count: 2 });
    expect(over2).toMatchObject({ allowed: false, count: 3 });
  });

  it('uses a fresh window when `now` crosses the boundary', async () => {
    const kv = mockKV();
    const opts = { key: 'ip:1.2.3.4', limit: LIMIT, windowSeconds: WINDOW };

    // Window A: starts at t=960 (floor(1000/60)*60), ends at 1020
    const a1 = await checkRateLimit(kv, { ...opts, now: () => 1000 });
    const a2 = await checkRateLimit(kv, { ...opts, now: () => 1015 });
    expect(a1.count).toBe(1);
    expect(a2.count).toBe(2);
    expect(a1.resetAt).toBe(1020);

    // Window B: starts at t=1020, ends at 1080
    const b1 = await checkRateLimit(kv, { ...opts, now: () => 1025 });
    expect(b1.count).toBe(1);
    expect(b1.resetAt).toBe(1080);

    // Keys differ — window A's entry still lives until TTL
    const dump = kv.dump();
    expect(dump.has('ip:1.2.3.4:960')).toBe(true);
    expect(dump.has('ip:1.2.3.4:1020')).toBe(true);
  });

  it('isolates counts across different keys', async () => {
    const kv = mockKV();
    const now = () => 1000;

    const alice = await checkRateLimit(kv, {
      key: 'email:alice@x.com',
      limit: LIMIT,
      windowSeconds: WINDOW,
      now,
    });
    const bob = await checkRateLimit(kv, {
      key: 'email:bob@x.com',
      limit: LIMIT,
      windowSeconds: WINDOW,
      now,
    });

    expect(alice.count).toBe(1);
    expect(bob.count).toBe(1);
    expect(alice.allowed).toBe(true);
    expect(bob.allowed).toBe(true);
  });

  it('degrades to allow-all when kv binding is undefined', async () => {
    const result = await checkRateLimit(undefined, {
      key: 'ip:1.2.3.4',
      limit: 1,
      windowSeconds: WINDOW,
      now: () => 1000,
    });
    expect(result).toEqual({
      allowed: true,
      count: 0,
      limit: 1,
      resetAt: 1020,
    });
  });

  it('treats non-numeric KV values as zero and proceeds', async () => {
    const kv = mockKV();
    // Simulate a garbage value at the key — e.g. stale migration
    await kv.put('ip:1.2.3.4:960', 'not-a-number');

    const result = await checkRateLimit(kv, {
      key: 'ip:1.2.3.4',
      limit: LIMIT,
      windowSeconds: WINDOW,
      now: () => 1000,
    });

    expect(result.count).toBe(1);
    expect(result.allowed).toBe(true);
  });

  it('resetAt aligns to the fixed window boundary', async () => {
    const kv = mockKV();
    const result = await checkRateLimit(kv, {
      key: 'ip:1.2.3.4',
      limit: LIMIT,
      windowSeconds: 300,
      now: () => 1234,
    });
    // floor(1234 / 300) * 300 = 1200, resetAt = 1500
    expect(result.resetAt).toBe(1500);
  });

  it('fails open when KV.get rejects', async () => {
    const failingKV: KVStore = {
      get: async () => {
        throw new Error('kv unavailable');
      },
      put: async () => {},
    };
    const result = await checkRateLimit(failingKV, {
      key: 'ip:1.2.3.4',
      limit: 1,
      windowSeconds: WINDOW,
      now: () => 1000,
    });
    expect(result).toEqual({
      allowed: true,
      count: 0,
      limit: 1,
      resetAt: 1020,
    });
  });

  it('fails open when KV.put rejects', async () => {
    const failingKV: KVStore = {
      get: async () => null,
      put: async () => {
        throw new Error('kv write failed');
      },
    };
    const result = await checkRateLimit(failingKV, {
      key: 'ip:1.2.3.4',
      limit: 1,
      windowSeconds: WINDOW,
      now: () => 1000,
    });
    expect(result).toEqual({
      allowed: true,
      count: 0,
      limit: 1,
      resetAt: 1020,
    });
  });
});
