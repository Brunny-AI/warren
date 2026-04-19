# warren — agent guidance

Public repo for the brunny.ai company website. (warren = rabbit
colony — the office where the agents live.)

## What this is

5-page kawaii company site with a pixel-art "virtual office"
hero that visualizes 4 AI agents (Alex, Scout, Derek, Kai) at
work. Built on Astro + Cloudflare Workers.

## Style guide

`.gemini/styleguide.md` is the source of truth for code style.
Based on Google's TypeScript, HTML/CSS, and Shell guides. Gemini
Code Assist enforces these on PR review; ESLint + Prettier
enforce locally and in CI (once scaffolded, via `npm run lint`).

## Tech stack

- **Astro 5** for pages and components
- **TypeScript** strict mode
- **Cloudflare Workers** runtime (Workers Assets + Bindings pattern)
- **D1** for email signup list
- **KV** for agent-status JSON cache
- **wrangler** for local dev + deploy

## Coding standards

- TypeScript: `strict: true`, no `any` without justification
- Prettier defaults (no manual formatting wars)
- ESLint via Astro's preset
- Web APIs only — no `fs`, `child_process`, `process.env` (use
  `Astro.locals.runtime.env` for Cloudflare bindings)
- Components are `.astro` files unless interactivity requires
  `.tsx` (then opt-in via `client:only` directive)

## PR workflow (mandatory)

Same bar as Brunny-AI/agent-os. See `.claude/rules/pr-workflow.md`.
Short version:

1. No direct commits to main (pre-commit hook + ruleset)
2. Branch name: `{agent}/{description}`
3. Commit format: `[agent] verb: description`
4. Pre-push privacy scan (hook installed via setup)
5. Open PR, fill in template
6. Wait for: Gemini auto-review, CodeQL, CI checks
7. Code Owner APPROVE required (the OTHER agent — not author)
8. Auto-merge fires when all gates green

## Local setup

See `README.md` + `CONTRIBUTING.md` for full setup. Summary:

```bash
# Install hooks (blocks direct-to-main + em-dash guard)
cp scripts/hooks/pre-commit .git/hooks/pre-commit
cp scripts/hooks/pre-push   .git/hooks/pre-push
chmod +x .git/hooks/pre-commit .git/hooks/pre-push
```

Brunny-internal agents: use per-agent SSH aliases + noreply
email per your onboarding runbook (off-repo). External
contributors: any git identity works for a fork + PR flow.

## What does NOT belong in this repo

- Brief code (lives elsewhere)
- Agent OS code (Brunny-AI/agent-os, public)
- Internal workspace state (workspaces/, system/, etc.)
- Real user data (use D1, scoped per environment)

## Product spec source-of-truth

The detailed product spec lives in an internal operating-docs
repo (not public). Highlights + rationale surface in commits on
`/log` and in `README.md`. When the public-facing spec needs
to evolve, open a `docs/spec.md` PR in this repo.
