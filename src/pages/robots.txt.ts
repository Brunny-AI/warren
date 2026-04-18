import type { APIRoute } from 'astro';

// Prerendered (static emit at build). The prior note on
// this file said "server-rendered to sidestep the Cloudflare
// adapter ASSETS binding clash with Pages-mode wrangler.toml"
// — that clash was removed by PR #23 (Pages → Workers + Static
// Assets migration), so prerender is now viable again. Zero
// per-request compute for the static text.
export const prerender = true;

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
