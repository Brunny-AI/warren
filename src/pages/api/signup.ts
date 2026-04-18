import type { APIRoute } from 'astro';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const email = extractEmail(body);
  if (!email) {
    return json({ error: 'email required' }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return json({ error: 'invalid email format' }, 400);
  }

  // Phase 1 scope: validate + log. D1 insert + Resend confirmation
  // land in follow-up PR once wrangler.toml bindings are wired.
  console.log(`[signup] ${email}`);

  return json({ ok: true }, 200);
};

function extractEmail(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = (body as Record<string, unknown>).email;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 254) return null;
  return trimmed;
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
