import type { APIRoute } from 'astro';

// Prerendered (static emit at build). The prior note on this
// file said "server-rendered to sidestep the ASSETS binding
// clash with Pages-mode wrangler.toml" — that clash was
// removed by PR #23 (Pages → Workers + Static Assets
// migration), so prerender is now viable. `lastmod` becomes
// build-time instead of request-time; search crawlers get the
// same ~daily precision either way.
export const prerender = true;

// Static set of indexable routes. Hand-maintained — the site
// is five pages; adding `@astrojs/sitemap` for this scale is
// dependency cost without payoff. When the page count grows
// past ~10 or dynamic routes appear, swap for the integration.
const ROUTES: readonly { path: string; priority: string }[] = [
  { path: '/', priority: '1.0' },
  { path: '/products', priority: '0.9' },
  { path: '/team', priority: '0.7' },
  { path: '/tools', priority: '0.6' },
  { path: '/contact', priority: '0.6' },
];

export const GET: APIRoute = ({ site }) => {
  if (!site) {
    // `site` is configured in astro.config.mjs; absence means
    // misconfiguration — fail loud rather than emit a sitemap
    // with relative URLs (which search engines reject).
    return new Response('sitemap unavailable: site URL not configured', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = ROUTES.map((r) => {
    const loc = new URL(r.path, site).toString();
    return [
      '  <url>',
      `    <loc>${loc}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <priority>${r.priority}</priority>`,
      '  </url>',
    ].join('\n');
  }).join('\n');

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls +
    '\n</urlset>\n';

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // 1h edge cache — search-engine crawlers revisit on
      // their own cadence; a fresher lastmod appearing an
      // hour late is fine.
      'cache-control': 'public, max-age=3600',
    },
  });
};
