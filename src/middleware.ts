import type { MiddlewareHandler } from 'astro';

/**
 * Security headers applied to every response. These are the
 * "cheap baseline" — no user-agent sniffing, no per-route
 * branching, no allowlist complexity. Each header is either
 * safe-by-default or documented as to why we diverge.
 *
 * Scope cuts (intentionally not set here):
 *   - Content-Security-Policy: needs per-route allowances
 *     (inline scripts on SignupForm, Astro's hydration
 *     assets, future third-party embeds). Lands in a
 *     follow-up PR with explicit source-list per section.
 *   - Strict-Transport-Security: owned by Cloudflare at the
 *     edge in production; setting it here would be redundant
 *     and risks lock-in on subdomains if misconfigured.
 */
const BASELINE_HEADERS: Readonly<Record<string, string>> = {
  // Refuse to guess MIME type when content-type disagrees
  // with content. Blocks a class of XSS/drive-by execution
  // where a .txt is served that actually contains <script>.
  'X-Content-Type-Options': 'nosniff',

  // Default-deny iframing. The site has no embed partners
  // or oEmbed consumers; if that changes, swap to
  // `frame-ancestors` CSP directive.
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
