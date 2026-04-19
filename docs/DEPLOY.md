# warren — Deploy checklist

First-time provisioning for brunny.ai on Cloudflare Workers.
Run in order. Each step has a verify command that must pass
before moving on.

Prereqs:
- `wrangler` logged in as the account that owns the `brunny.ai`
  zone (`wrangler whoami`).
- Clean `npm run build` locally (catches adapter wiring before
  wasting a deploy slot).

## 1. Create the D1 database

```bash
wrangler d1 create warren
```

Paste the returned `database_id` into `wrangler.toml` under
`[[d1_databases]] → database_id`, replacing
`PLACEHOLDER_UNTIL_PROVISIONED`. Commit that change.

**Verify:**
```bash
wrangler d1 list | grep warren
```

## 2. Apply the migrations (in order)

```bash
wrangler d1 execute warren --remote \
  --file=./migrations/0000_init_signups.sql
wrangler d1 execute warren --remote \
  --file=./migrations/0001_add_confirmation_token.sql
```

Order matters: `0001` adds the `confirmation_token` column
that `/api/signup` writes. Applying `0001` before `0000`
errors on the missing table.

**Verify:**
```bash
wrangler d1 execute warren --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table';"
# expect: signups

wrangler d1 execute warren --remote \
  --command="PRAGMA table_info(signups);"
# expect columns: email, created_at, source, confirmed_at, confirmation_token
```

## 3. Create the KV namespace (rate-limit bucket)

```bash
wrangler kv namespace create RATE_LIMIT
```

Paste the returned `id` into `wrangler.toml` under
`[[kv_namespaces]] → id`, replacing
`PLACEHOLDER_UNTIL_PROVISIONED`. Commit.

**Verify:**
```bash
wrangler kv namespace list | grep RATE_LIMIT
```

## 4. Provision secrets

Three required secrets. `wrangler secret put` prompts for the
value; never paste secrets into this checklist.

```bash
wrangler secret put RESEND_API_KEY
# paste: re_...

wrangler secret put RESEND_FROM_ADDRESS
# paste: brunny <hi@brunny.ai>
# (sender domain must be verified in Resend dashboard first)

wrangler secret put ADMIN_TOKEN
# Generate a 32-byte token (paste the output when prompted):
#   openssl rand -hex 32
# (32 bytes hex = 64 chars; well above the 32-char floor.)
# Used for Authorization: Bearer <token> on /api/admin/*.
```

**Verify:**
```bash
wrangler secret list
# expect all 3 present
```

Without `RESEND_API_KEY` + `RESEND_FROM_ADDRESS`, `/api/signup`
still persists rows to D1 but silently skips the confirmation
email (soft-success). Without `ADMIN_TOKEN`, the stats endpoint
returns 503 (not provisioned) — intentional, see
`src/pages/api/admin/signup-stats.ts`.

## 5. Deploy

```bash
npm run build
wrangler deploy
```

**Verify:**
```bash
# 1. Healthy root
curl -I https://brunny.ai

# 2. Signup form accepts POST (dry-run a fake email)
curl -X POST https://brunny.ai/api/signup \
  -H "content-type: application/json" \
  -d '{"email":"test@example.com","source":"products"}'
# expect: {"ok":true}  (HTTP 200)

# 3. Stats endpoint gated
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://brunny.ai/api/admin/signup-stats
# expect: JSON with total, confirmed, pending_confirm, ...

# 4. Stats rejects wrong token
curl -H "Authorization: Bearer wrong" \
  -i https://brunny.ai/api/admin/signup-stats
# expect: HTTP 401

# 5. CSP header present on an HTML route
curl -I https://brunny.ai/products | grep -i content-security-policy
# expect: one CSP header, with report-uri=/api/csp-report
```

## Rollback

If step 5 verify fails:

```bash
wrangler rollback            # Workers versioned deploy rollback
```

Then inspect Cloudflare dashboard Workers → Logs for the failing
request. Common causes: D1 binding ID mismatch in `wrangler.toml`
vs. actual, missing secret, migration skipped.

## Troubleshooting

### Use `scripts/dev-bootstrap.sh` for local D1 setup (don't run wrangler manually)

The script handles the full setup + migration + verify loop and
surfaces the wrangler 4.83.0 silent-failure gotcha (`--yes` flag
reports success but skips actual init). Just:

```bash
./scripts/dev-bootstrap.sh
```

To force-reset existing local state:

```bash
WARREN_BOOTSTRAP_RESET=1 ./scripts/dev-bootstrap.sh
```

The rest of this section explains the underlying mechanics if the
script fails or you want to do it by hand.

### `wrangler d1 migrations apply` reports success but tables aren't created

Cause: wrangler 4.83.0 has a regression where `--yes`
(skip-confirmation) silently skips the actual D1 init step. Repro:
running `wrangler d1 migrations apply warren --local --yes` exits 0
and prints the migration table, but `sqlite_master` only has
`_cf_METADATA` — no `signups`, no `d1_migrations`.

Workaround (what `dev-bootstrap.sh` does internally): pipe `y` to
the interactive prompt instead of using `--yes`:

```bash
echo y | npx wrangler d1 migrations apply warren --local
```

Then verify:

```bash
npx wrangler d1 execute warren --local \
  --command="SELECT name FROM sqlite_master WHERE type='table'"
# expect: signups, d1_migrations, _cf_METADATA
```

### `wrangler d1 migrations apply` errors with "duplicate column name: confirmation_token"

Cause: local `.wrangler/state` cache has the column applied but the
`d1_migrations` tracker is out of sync (often happens when
`vitest-pool-workers` or a prior failed run left half-state).
SQLite `ALTER TABLE ... ADD COLUMN` does not support
`IF NOT EXISTS` (per the SQLite spec), so the migration cannot
self-recover.

Cleanup:

```bash
# Local dev only — never against prod.
WARREN_BOOTSTRAP_RESET=1 ./scripts/dev-bootstrap.sh
```

This rebuilds the local D1 from scratch with all migrations applied
in order. Production D1 is unaffected because the d1_migrations
tracker there prevents re-runs.

### `POST /api/signup` returns 500 locally

Likely causes (in order of frequency):

1. **D1 binding missing or unmigrated.** Check
   `npx wrangler d1 execute warren --local --command="SELECT name FROM sqlite_master WHERE type='table'"`
   shows the `signups` and `d1_migrations` tables. If not, run the
   migrations apply from §"duplicate column name" above.
2. **`RESEND_API_KEY` secret not set in `.dev.vars`.** Signup INSERT
   succeeds but the post-insert email send throws and the handler
   surfaces 500 if `ctx.waitUntil` propagation isn't masking it.
   Add the key to `.dev.vars` (or set `RESEND_FROM_ADDRESS=` to a
   verified Resend sender).
3. **`KV` rate-limit binding placeholder.** `RATE_LIMIT` is a
   placeholder until provisioned. The handler fails open on KV
   errors, but if your local wrangler config has the binding
   pointing at a non-existent namespace ID, the request can 500
   before reaching the fail-open path. Comment out the binding in
   `wrangler.toml` for local dev or provision the namespace.

## Non-goals (intentionally not here)

- No CI-deploy workflow. Deploys are founder-initiated for now
  (directive 2026-04-18: "no need to deploy — local build/
  testing passed before that step").
- No analytics/tracking wiring. Observability is structured
  `console.log` only until content quality earns beta.
- No auto-applied migrations on deploy. Schema changes are
  manual + verified against `wrangler d1 execute` output before
  the deploying version references the new columns.
