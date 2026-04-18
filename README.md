# warren

The brunny.ai company website. (warren = rabbit colony — the
office where AI agents live and work.)

**Status:** Public, pre-launch. Built in the open.

## Stack

- **Astro 5** (Cloudflare-acquired Jan 2026)
- **Cloudflare Workers + Static Assets** via `@astrojs/cloudflare`
  v13.1 adapter (not Pages — Workers is the forward path)
- **D1** for the signup list (`signups` table, 2 migrations)
- **KV** for per-IP rate-limit counters (fixed-window, 1h bucket)
- **Resend** for transactional email (double-opt-in confirmation)

## API Surface

| Route                        | Method | Purpose                                       |
|------------------------------|--------|-----------------------------------------------|
| `/api/signup`                | POST   | Form or JSON body. Validates + rate-limits + inserts into D1 + fires Resend confirmation. |
| `/api/confirm`               | GET    | `?token=<uuid>` — marks signup confirmed. Idempotent on reclick. |
| `/api/admin/signup-stats`    | GET    | `Authorization: Bearer $ADMIN_TOKEN`. Returns funnel counts + timestamps + by_source breakdown. |
| `/api/csp-report`            | POST   | Receives `application/csp-report` + `application/reports+json`. Returns 204 (accept-and-drop for MVP). |

## Security

- Global middleware applies CSP, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`,
  `Reporting-Endpoints` on every response
- CSP violation reports route to `/api/csp-report`
- `ADMIN_TOKEN`-gated endpoints use constant-time bearer
  comparison (no timing-leak of the token prefix)
- Rate-limit keys include `cf-connecting-ip` (Cloudflare sets
  + strips client-supplied values — trusted in runtime)

## Repo Layout

```
src/
  pages/             Astro pages (5 flat: /, /products, /team, /tools, /contact)
  pages/api/         API routes (signup, confirm, admin/signup-stats, csp-report)
  components/        Shared components (nav, footer, SignupForm)
  layouts/           Layout templates
  lib/               Pure helpers (email, log, rate-limit)
  middleware.ts      Security headers + CSP + Reporting-Endpoints
  styles/            CSS / theme tokens
public/              Static assets (favicons, OG images, sprite sheets)
migrations/          D1 schema (0000_init_signups, 0001_add_confirmation_token)
tests/               Vitest suites (one per API surface + each lib helper)
.claude/rules/       Internal contributor rules
.github/             CODEOWNERS, PR template, workflows
scripts/hooks/       Git hooks (pre-commit, pre-push)
wrangler.toml        Cloudflare Workers config (bindings only — adapter supplies main + [assets])
```

## Product Spec

`workspaces/kai/scratch/brunny-site-product-spec-v2.md` (in
brunny-ai monorepo) is the source-of-truth product spec.

## Governance

This repo follows the same PR workflow rigor as Brunny-AI/agent-os:

- No direct commits to main (pre-commit hook + ruleset)
- Code Owner review required (CODEOWNERS = scout + kai, GitHub
  blocks self-approval so author's review never counts)
- Stale reviews dismissed on push (force re-verification after
  any commit post-approval)
- Required status checks (CI) before merge
- Auto-merge enabled — author clicks "Enable auto-merge", GitHub
  waits for all gates, merges automatically
- Step 6 verification: Code Owner verifies Gemini Code Assist
  feedback was properly addressed (class-level, not just the
  literal flagged line)

See `.claude/rules/pr-workflow.md` for the full pipeline.

## License

All rights reserved. Brunny AI LLC.
