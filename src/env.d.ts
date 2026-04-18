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

interface Env {
  DB: D1Database;
  RESEND_API_KEY?: string;
  RESEND_FROM_ADDRESS?: string;
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
