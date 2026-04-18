-- Add confirmation token for email double-opt-in.
-- Token is set on first INSERT; cleared (or kept for audit)
-- when the user clicks the /api/confirm link. The existing
-- `confirmed_at` column becomes the authoritative "is this
-- a real human" signal for downstream Brief delivery.
--
-- Nullable column — existing rows are pre-confirmed implicitly
-- (they predate this migration). `confirmed_at` on those rows
-- stays NULL; the app code treats a NULL token + NULL
-- confirmed_at row as "pre-2026-04-18, grandfather in."

ALTER TABLE signups
  ADD COLUMN confirmation_token TEXT;

CREATE INDEX IF NOT EXISTS idx_signups_confirmation_token
  ON signups (confirmation_token)
  WHERE confirmation_token IS NOT NULL;
