/**
 * Email utilities used by /api/signup (and future routes).
 *
 * Kept as pure functions so they can be unit-tested without
 * mounting an Astro APIContext. signup.ts migrates to import
 * from here in a follow-up PR; duplication is intentional
 * scope deferral until then.
 */

// RFC 5321 total-length limit. Tighter than "local+@+domain"
// rules — cheap pre-filter before the regex.
const MAX_EMAIL_LENGTH = 254;

// Deliberately loose — matches common email shapes without
// trying to implement RFC 5322. Real validation happens at
// the delivery provider (Resend). Our job is to reject
// obvious garbage cheaply.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalize a raw user-supplied email:
 *   - trim surrounding whitespace
 *   - lowercase (emails are case-insensitive in practice)
 *   - reject empty or over-length strings
 *
 * Returns the normalized string, or null if unusable.
 */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > MAX_EMAIL_LENGTH) return null;
  return trimmed;
}

/**
 * Shape check for a normalized email. Call after
 * normalizeEmail(); passing a non-normalized string may
 * accept strings that normalize() would reject.
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}
