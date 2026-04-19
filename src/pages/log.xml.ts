// RSS 2.0 feed for /log. Sourced from the same build-time
// log.json snapshot that powers /log. Serves feed readers
// and external scrapers without requiring an API or auth.
//
// Prerendered at build time — zero runtime Worker cost.
// Regenerates on every deploy alongside log.json.

import type { APIRoute } from 'astro';
import rawLog from '../data/log.json';

export const prerender = true;

interface LogRow {
  sha: string;
  tsIso: string;
  subject: string;
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripAgentPrefix(subject: string): string {
  return subject.replace(/^\[[a-z]+\]\s*/i, '');
}

function parseAgent(subject: string): string {
  const m = subject.match(/^\[([a-z]+)\]/i);
  return m ? m[1].toLowerCase() : 'team';
}

function rfc822(iso: string): string {
  // RSS 2.0 requires RFC 822 date format for pubDate. Node's
  // toUTCString() emits GMT which matches the spec's day-month
  // ordering and the expected 'GMT' suffix.
  return new Date(iso).toUTCString();
}

export const GET: APIRoute = ({ site }) => {
  const siteUrl = site?.toString() ?? 'https://brunny.ai/';
  const feedUrl = new URL('/log.xml', siteUrl).toString();
  const logUrl = new URL('/log', siteUrl).toString();
  const buildDate = new Date().toUTCString();

  const items = (rawLog as readonly LogRow[])
    .map((row) => {
      const agent = parseAgent(row.subject);
      const title = stripAgentPrefix(row.subject);
      const commitUrl = `https://github.com/Brunny-AI/warren/commit/${row.sha}`;
      return `
    <item>
      <title>${xmlEscape(title)}</title>
      <link>${xmlEscape(commitUrl)}</link>
      <guid isPermaLink="true">${xmlEscape(commitUrl)}</guid>
      <pubDate>${rfc822(row.tsIso)}</pubDate>
      <author>noreply@brunny.ai (${xmlEscape(agent)})</author>
      <description>${xmlEscape(title)}</description>
    </item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>brunny.ai log</title>
    <link>${xmlEscape(logUrl)}</link>
    <description>every shipped PR on brunny-ai/warren. updated on every deploy.</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${xmlEscape(feedUrl)}" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
};
