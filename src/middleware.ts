import type { MiddlewareHandler } from 'astro';

/**
 * Security headers applied to every response. These are the
 * "cheap baseline" — no user-agent sniffing, no per-route
 * branching, no allowlist complexity. Each header is either
 * safe-by-default or documented as to why we diverge.
 *
 * Scope cuts (intentionally not set here):
 *   - Strict-Transport-Security: owned by Cloudflare at the
 *     edge in production; setting it here would be redundant
 *     and risks lock-in on subdomains if misconfigured.
 */

// CSP directives as structured dict, flattened on serve. Each
// directive documents its reason; when we add a new source
// (e.g. fonts.googleapis.com), we extend the relevant list and
// note why.
const CSP_DIRECTIVES: Readonly<Record<string, readonly string[]>> = {
  // Default-deny for any directive not explicitly set below.
  'default-src': ["'self'"],

  // Scripts: 'self' for Astro's hydration bundles. 'unsafe-
  // inline' is required for SignupForm.astro's `define:vars`
  // inline submit handler and Astro's client-directive
  // bootstrap. Nonce-based CSP is the right long-term answer
  // but needs SSR nonce plumbing per render — a separate PR.
  'script-src': ["'self'", "'unsafe-inline'"],

  // Styles: Astro's scoped `<style>` blocks compile to inline
  // <style> tags. 'unsafe-inline' unavoidable until Astro
  // supports nonce-based style injection.
  'style-src': ["'self'", "'unsafe-inline'"],

  // Images: self + inline base64 (favicon uses data: URI in
  // SVG format). No remote image hosts today.
  'img-src': ["'self'", 'data:'],

  'font-src': ["'self'"],

  // Fetch/XHR: just /api/signup today, which is same-origin.
  'connect-src': ["'self'"],

  // Form submits: SignupForm POSTs to same-origin /api/signup
  // via native form action. 'self' blocks cross-site form
  // tampering.
  'form-action': ["'self'"],

  // Embedding: no one may iframe us. Supersedes the legacy
  // X-Frame-Options header below (both are kept — older
  // browsers still read XFO; modern browsers prefer CSP).
  'frame-ancestors': ["'none'"],

  // Block any attempt to load this page inside an <object>,
  // <embed>, or <applet>.
  'object-src': ["'none'"],

  // Base tag attack mitigation (prevents a compromised script
  // from rewriting relative URLs via <base>).
  'base-uri': ["'self'"],
};

function _buildCsp(
  directives: Readonly<Record<string, readonly string[]>>,
): string {
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}

const BASELINE_HEADERS: Readonly<Record<string, string>> = {
  // Refuse to guess MIME type when content-type disagrees
  // with content. Blocks a class of XSS/drive-by execution
  // where a .txt is served that actually contains <script>.
  'X-Content-Type-Options': 'nosniff',

  // Default-deny iframing. CSP `frame-ancestors` (below) is
  // the modern equivalent; XFO stays for older-browser reach.
  'X-Frame-Options': 'DENY',

  // Send origin on same-origin navigations, nothing cross-
  // origin. Prevents leaking query params (e.g. `?signup=`
  // query states) to outbound link destinations.
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Deny by default for powerful features. Adjust when a
  // real use-case appears (e.g. geolocation for future
  // agent mapping).
  'Permissions-Policy':
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), ' +
    'magnetometer=(), microphone=(), payment=(), usb=()',

  // Content Security Policy. Structured in CSP_DIRECTIVES
  // above so each directive + rationale lives next to the
  // sources it allows. 'unsafe-inline' on script-src +
  // style-src is an acknowledged gap — nonce-based CSP
  // requires SSR plumbing per render, follow-up PR.
  'Content-Security-Policy': _buildCsp(CSP_DIRECTIVES),
};

export const onRequest: MiddlewareHandler = async (_context, next) => {
  const response = await next();

  // Only set headers we don't already have. An upstream
  // handler that intentionally sets a different value (e.g.
  // a per-route Permissions-Policy) wins.
  for (const [key, value] of Object.entries(BASELINE_HEADERS)) {
    if (!response.headers.has(key)) {
      response.headers.set(key, value);
    }
  }

  return response;
};
