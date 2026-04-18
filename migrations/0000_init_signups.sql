-- signups: email list for product launch notifications
-- email as PRIMARY KEY gives us idempotency for free via
-- INSERT OR IGNORE — duplicate submits silently dedupe.

CREATE TABLE IF NOT EXISTS signups (
  email        TEXT    NOT NULL PRIMARY KEY,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  source       TEXT    NOT NULL DEFAULT 'products-page',
  confirmed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_signups_created_at
  ON signups (created_at);
