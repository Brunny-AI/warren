import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * CSP violation reporting endpoint.
 *
 * Browsers POST reports here when a Content-Security-Policy
 * directive blocks a resource. Two report formats are in use:
 *
 *   - Legacy `application/csp-report` — sent to `report-uri`
 *     directive (deprecated but still the only format in
 *     Safari as of 2025).
 *   - Modern `application/reports+json` — sent to the
 *     Reporting-Endpoints-named endpoint (Chrome, Firefox,
 *     Edge via the `report-to` CSP directive).
 *
 * MVP scope: accept both, drop silently (204 No Content).
 * Prevents 404 spam in browser consoles without adding a
 * storage dependency. A follow-up PR can persist reports to
 * D1 `csp_violations` for observability dashboards.
 *
 * No bindings required. No rate-limit on this path — browsers
 * emit reports opportunistically; a spike is already a signal
 * worth investigating, not something to suppress.
 */
export const POST: APIRoute = async ({ request }) => {
  const contentType = (request.headers.get('content-type') ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();

  const accepted = (
    contentType === 'application/csp-report'
    || contentType === 'application/reports+json'
  );

  if (!accepted) {
    // Reject unknown payloads so this endpoint isn't a generic
    // drop bucket for arbitrary POSTs (log spam / abuse).
    return new Response(null, { status: 415 });
  }

  // Drain the body so connection-tracking doesn't leak, but
  // don't parse it — we're not persisting yet. Failure to
  // read (truncated POST) is non-fatal; the browser retries
  // on next violation.
  try {
    await request.text();
  } catch {
    // Swallow — malformed report bodies happen, not our
    // problem to recover from.
  }

  // 204 No Content is the idiomatic CSP-report response:
  // the browser expects nothing back and we have nothing to
  // return. Avoids wasted bytes on a high-volume endpoint.
  return new Response(null, { status: 204 });
};
