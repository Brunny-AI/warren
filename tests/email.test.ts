import { describe, it, expect } from 'vitest';
import { normalizeEmail, isValidEmail } from '../src/lib/email';

describe('normalizeEmail', () => {
  it('trims and lowercases a valid email', () => {
    expect(normalizeEmail('  Foo@BAR.com  ')).toBe('foo@bar.com');
  });

  it('returns null for null / undefined / non-string', () => {
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
    // Defensive even though the type says string | null | undefined
    expect(normalizeEmail(42 as unknown as string)).toBeNull();
    expect(normalizeEmail({} as unknown as string)).toBeNull();
  });

  it('returns null for empty / whitespace-only', () => {
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('   ')).toBeNull();
    expect(normalizeEmail('\t\n')).toBeNull();
  });

  it('rejects strings over 254 chars (RFC 5321)', () => {
    const local = 'a'.repeat(250);
    expect(normalizeEmail(`${local}@b.co`)).toBeNull();
  });

  it('accepts the 254-char boundary', () => {
    const local = 'a'.repeat(249);
    const email = `${local}@b.co`;
    expect(email.length).toBe(254);
    expect(normalizeEmail(email)).toBe(email);
  });

  it('preserves internal structure (plus-addressing, dots)', () => {
    expect(normalizeEmail('user.name+tag@example.com')).toBe(
      'user.name+tag@example.com',
    );
  });
});

describe('isValidEmail', () => {
  it('accepts common shapes', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('user.name+tag@example.com')).toBe(true);
    expect(isValidEmail('x@y.z.co.uk')).toBe(true);
  });

  it('rejects obvious garbage', () => {
    expect(isValidEmail('no-at-sign')).toBe(false);
    expect(isValidEmail('two@@signs.com')).toBe(false);
    expect(isValidEmail('missing-tld@foo')).toBe(false);
    expect(isValidEmail('@missing-local.com')).toBe(false);
    expect(isValidEmail('trailing-at@')).toBe(false);
    expect(isValidEmail('space in@email.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('expects a normalized input — does not trim/lowercase', () => {
    // By contract, callers run normalizeEmail first.
    expect(isValidEmail('  a@b.co  ')).toBe(false);
  });
});
