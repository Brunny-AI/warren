/**
 * Structured event logging.
 *
 * Writes single-line JSON to stdout on Cloudflare Workers —
 * picked up by `wrangler tail` in dev and forwarded to the
 * Workers Logs destination in prod (Logpush / R2 / Analytics
 * Engine as configured downstream; not this module's concern).
 *
 * Constraints:
 *   - NO PII. The caller is responsible for not passing email
 *     addresses, IP addresses, or other identifying fields.
 *     This module does no redaction; it's an append-only
 *     counter/state channel.
 *   - Shape is `{ts, event, ...fields}` so log queries can
 *     filter on `event` and aggregate on the rest. Timestamp
 *     is ISO 8601 UTC (Workers clock).
 *   - Single `console.log` call per event so the emit is
 *     atomic and never tears across lines.
 */

export type LogFields = Readonly<Record<string, string | number | boolean>>;

/**
 * Emit a structured event. Returns void — log writes are
 * fire-and-forget; a failure to write (e.g. if the runtime
 * is paused between calls) should not break the caller.
 */
export function logEvent(event: string, fields: LogFields = {}): void {
  const line = {
    ts: new Date().toISOString(),
    event,
    ...fields,
  };
  // Single console.log: atomic line, no tearing under
  // concurrent workers.
  console.log(JSON.stringify(line));
}
