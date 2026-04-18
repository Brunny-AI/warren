import type { APIRoute } from 'astro';

// Server-rendered (not prerender: true) to sidestep a
// Cloudflare-adapter-generated ASSETS binding clash with
// the current Pages-mode wrangler.toml. Compute cost is
// negligible — a handful of string joins per request —
// and future-proofs the Workers+Static-Assets migration.
export const GET: APIRoute = ({ site }) => {
  const sitemapUrl = site ? new URL('/sitemap.xml', site).toString() : '';
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    sitemapUrl ? `Sitemap: ${sitemapUrl}` : '',
    '',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      // Crawlers rarely refetch robots.txt; 1h is plenty.
      'cache-control': 'public, max-age=3600',
    },
  });
};
