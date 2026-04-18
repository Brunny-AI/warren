import { describe, it, expect } from 'vitest';

import { POST } from '../src/pages/api/csp-report';

async function callPost(opts: {
  contentType: string;
  body?: string;
}): Promise<Response> {
  const request = new Request('http://localhost/api/csp-report', {
    method: 'POST',
    headers: { 'content-type': opts.contentType },
    body: opts.body ?? '',
  });
  const ctx = { request } as unknown as Parameters<typeof POST>[0];
  return POST(ctx);
}

describe('POST /api/csp-report', () => {
  it('accepts legacy application/csp-report with 204', async () => {
    const body = JSON.stringify({
      'csp-report': {
        'document-uri': 'https://brunny.ai/',
        'violated-directive': 'script-src',
        'blocked-uri': 'inline',
      },
    });
    const res = await callPost({
      contentType: 'application/csp-report',
      body,
    });
    expect(res.status).toBe(204);
  });

  it('accepts modern application/reports+json with 204', async () => {
    const body = JSON.stringify([
      {
        type: 'csp-violation',
        body: { documentURL: 'https://brunny.ai/' },
      },
    ]);
    const res = await callPost({
      contentType: 'application/reports+json',
      body,
    });
    expect(res.status).toBe(204);
  });

  it('handles content-type with charset suffix', async () => {
    const res = await callPost({
      contentType: 'application/csp-report; charset=utf-8',
      body: '{}',
    });
    expect(res.status).toBe(204);
  });

  it('rejects unknown content-type with 415', async () => {
    const res = await callPost({
      contentType: 'application/json',
      body: '{}',
    });
    expect(res.status).toBe(415);
  });

  it('rejects missing content-type with 415', async () => {
    // Explicit empty content-type → 415 (defensive against
    // being a generic drop bucket for un-typed POSTs)
    const res = await callPost({
      contentType: '',
      body: '{}',
    });
    expect(res.status).toBe(415);
  });

  it('tolerates malformed body (drained, not parsed)', async () => {
    // Endpoint reads the body but never parses it. Garbage
    // JSON is still a 204.
    const res = await callPost({
      contentType: 'application/csp-report',
      body: '{not-valid-json',
    });
    expect(res.status).toBe(204);
  });

  it('returns empty body (204 semantics)', async () => {
    const res = await callPost({
      contentType: 'application/csp-report',
      body: '{}',
    });
    expect(await res.text()).toBe('');
  });
});
