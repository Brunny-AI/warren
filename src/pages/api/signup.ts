import type { APIRoute } from 'astro';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, redirect }) => {
  const mediaType = (request.headers.get('content-type') ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  const isJson = mediaType === 'application/json';
  const wantsHtml = !isJson;

  let raw: string | null = null;
  if (isJson) {
    try {
      const body = await request.json();
      if (typeof body === 'object' && body !== null) {
        const v = (body as Record<string, unknown>).email;
        if (typeof v === 'string') raw = v;
      }
    } catch {
      return json({ error: 'invalid json' }, 400);
    }
  } else {
    const form = await request.formData();
    const v = form.get('email');
    if (typeof v === 'string') raw = v;
  }

  const email = normalize(raw);
  if (!email) {
    return wantsHtml
      ? redirect('/products?signup=missing', 303)
      : json({ error: 'email required' }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return wantsHtml
      ? redirect('/products?signup=invalid', 303)
      : json({ error: 'invalid email format' }, 400);
  }

  // Phase 1 scope: validate + acknowledge. D1 insert + Resend
  // confirmation land in a follow-up PR once wrangler.toml
  // bindings are wired. Intentionally NOT logging the email —
  // Workers provider logs would become a raw-PII sink.
  return wantsHtml
    ? redirect('/products?signup=saved', 303)
    : json({ ok: true }, 200);
};

function normalize(raw: string | null): string | null {
  if (raw === null) return null;
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
