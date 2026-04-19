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

## Pages

| Route         | Role                                                                 |
|---------------|----------------------------------------------------------------------|
| `/`           | Landing. Hero signup + 3-card lifecycle (Brief/warren/agent-os) + virtual-office tagline. |
| `/products`   | 3-card lifecycle in depth + signup block.                            |
| `/team`       | 5-member roster. Each agent card surfaces their last shipped PR. |
| `/contact`    | 4 contact lanes + transparency block linking `/log`.                 |
| `/log`        | Build-time changelog from `git log`. Ship-rate banner + RSS link.    |
| `/log.xml`    | RSS 2.0 feed. One item per merged PR. Prerendered.                   |
| `/404`        | Clean 404 with nav fallbacks.                                        |

## API Surface

| Route                        | Method | Purpose                                       |
|------------------------------|--------|-----------------------------------------------|
| `/api/signup`                | POST   | Form or JSON body. Validates + rate-limits + inserts into D1 + fires Resend confirmation. |
| `/api/confirm`               | GET    | `?token=<uuid>`. Marks signup confirmed. Idempotent on reclick. |
| `/api/admin/signup-stats`    | GET    | `Authorization: Bearer $ADMIN_TOKEN`. Returns funnel counts + timestamps + by_source breakdown. |
| `/api/csp-report`            | POST   | Receives `application/csp-report` + `application/reports+json`. Returns 204. |

## Security

- Global middleware applies CSP, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`,
  `Reporting-Endpoints` on every response
- CSP violation reports route to `/api/csp-report`
- `ADMIN_TOKEN`-gated endpoints use constant-time bearer
  comparison (no timing-leak of the token prefix)
- Rate-limit keys include `cf-connecting-ip` (Cloudflare sets
  + strips client-supplied values, trusted in runtime)
- Em-dash pre-commit hook blocks user-facing em-dashes on
  `src/**` + `docs/**` (install via `scripts/hooks/`).

## Repo Layout

```
src/
  pages/             Astro pages (/, /products, /team, /contact, /log, /404)
  pages/log.xml.ts   RSS 2.0 feed endpoint (prerendered)
  pages/api/         API routes (signup, confirm, admin/signup-stats, csp-report)
  components/        Shared components (Nav, Footer, SignupForm)
  layouts/           Layout templates
  lib/               Pure helpers (email, log, rate-limit)
  middleware.ts      Security headers + CSP + request log emit
  data/log.json      Build-time git-log snapshot (regenerated on every build)
  styles/            CSS / theme tokens
public/              Static assets (favicons, og-default.{svg,png})
migrations/          D1 schema (0000_init_signups, 0001_add_confirmation_token)
tests/               Vitest suites (one per API surface + each lib helper)
scripts/
  gen-log.sh         Runs on `npm run prebuild`, writes src/data/log.json
  hooks/             Git hooks (pre-commit w/ em-dash guard + main-push block, pre-push)
  dogfood/           Playwright walkthrough + a11y specs
.claude/rules/       Internal contributor rules
.github/             CODEOWNERS, PR template, workflows
scripts/hooks/       Git hooks (pre-commit, pre-push)
wrangler.toml        Cloudflare Workers config (bindings only — adapter supplies main + [assets])
```

## Setup

```bash
git clone https://github.com/Brunny-AI/warren.git
cd warren
npm ci
cp .dev.vars.example .dev.vars   # then paste Resend API key + from-address
```

Install git hooks (em-dash guard, privacy scan, main-push block):

```bash
cp scripts/hooks/pre-commit .git/hooks/pre-commit
cp scripts/hooks/pre-push   .git/hooks/pre-push
chmod +x .git/hooks/pre-commit .git/hooks/pre-push
```

## Dev

```bash
npm run dev              # astro dev on :4321, hot reload
npm run build            # Astro build; catches adapter wiring before deploy
npm run typecheck        # astro check; 0 errors gate
```

To exercise the Cloudflare Workers runtime locally (needed for
D1 + KV bindings in `/api/*` routes):

```bash
npm run build && npx wrangler dev --port 8788
```

The `prebuild` hook runs `scripts/gen-log.sh`, which writes
`src/data/log.json` from local `git log`. `/log` and `/log.xml`
read that snapshot, so the feed reflects whatever branch you
built on.

## Testing

```bash
npm test                 # Vitest unit + API-route suites
npx playwright install --with-deps chromium   # one-time, if missing
npx playwright test                            # dogfood walkthrough + a11y
npx playwright test --ui                       # headed mode for debugging
```

Test expectations:

- Unit + API tests hit mocked D1 / KV / Resend. No prod creds needed.
- Playwright tests require `npm run dev` running in another terminal (spec reads `WARREN_BASE_URL`, defaults to `http://localhost:8788`).
- CI runs the same commands; local green predicts CI green.

First-time deploy (provisioning D1 + KV + secrets) is in
[`docs/DEPLOY.md`](docs/DEPLOY.md). Dogfood + review protocol
is in [`docs/DOGFOOD.md`](docs/DOGFOOD.md).

## Product Spec

The source-of-truth product spec is internal (private
operating-docs repo). Highlights and rationale surface in
commits on `/log` and in this README; the spec itself is not
public.

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
