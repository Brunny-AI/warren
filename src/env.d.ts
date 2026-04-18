/// <reference types="astro/client" />

// Minimal D1 surface used by our routes. Regenerate with
// `wrangler types` when the worker-configuration.d.ts lands
// in a later PR; until then the inline shape avoids adding
// @cloudflare/workers-types as a dep.
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ meta?: { changes?: number } }>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

// Minimal KV surface used by the rate-limit module.
// Structurally compatible with Cloudflare's KVNamespace.
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

interface Env {
  DB: D1Database;
  RATE_LIMIT?: KVNamespace;
  RESEND_API_KEY?: string;
  RESEND_FROM_ADDRESS?: string;
  /**
   * Shared secret for /api/admin/* endpoints. When absent,
   * admin endpoints return 503 (not provisioned) — NOT 401.
   * Intentional: distinguish "no admin access configured"
   * from "access denied with wrong token."
   */
  ADMIN_TOKEN?: string;
}

declare namespace App {
  interface Locals {
    runtime: {
      env: Env;
      ctx: {
        waitUntil(promise: Promise<unknown>): void;
      };
    };
  }
}
