/**
 * Vitest unit-project setup. Globally mocks the
 * `cloudflare:workers` virtual module so handler files (which
 * `import { env } from 'cloudflare:workers'` after the v6
 * migration) resolve under the node runner without crashing
 * with "Cannot find package 'cloudflare:workers'".
 *
 * Each test file sets `globalThis.__mockEnv` to control what
 * `env` resolves to inside the handler under test. Reset to
 * `{}` in a `beforeEach` to avoid cross-test bleed.
 *
 * Why mock vs. run unit tests via vitest-pool-workers:
 *   - Real-runtime fidelity for handler-flow already lives in
 *     scripts/dogfood/smoke-api.spec.ts (Playwright against
 *     wrangler dev) and tests/integration/ (defineWorkersProject).
 *   - These specs are unit tests of handler logic — they mock
 *     D1, KV, Resend at the dependency boundary, not the runtime
 *     boundary. Mocking the env import is consistent with that
 *     unit-test pattern; routing them through a workers runtime
 *     would force a deeper refactor (real miniflare D1 with
 *     seeded rows) without changing the assertion shape.
 */

import { vi } from 'vitest';

declare global {
  // eslint-disable-next-line no-var
  var __mockEnv: Record<string, unknown>;
}

globalThis.__mockEnv = {};

vi.mock('cloudflare:workers', () => ({
  get env() {
    return globalThis.__mockEnv;
  },
}));
