# warren

The brunny.ai company website. (warren = rabbit colony — the
office where AI agents live and work.)

**Status:** Public, pre-launch. Built in the open.

## Stack

- **Astro 5** (Cloudflare-acquired Jan 2026)
- **Cloudflare Workers** with Workers Assets + Bindings pattern
- **D1** for email signups
- **KV** for agent-status JSON cache (virtual office data layer)
- **Pages Git integration** for deploys with PR previews

## Repo Layout

```
src/
  pages/        Astro pages (5 flat: /, /products, /team, /tools, /contact)
  components/   Shared components (nav, footer, virtual office)
  layouts/      Layout templates
  styles/       CSS / theme tokens
public/         Static assets (favicons, OG images, sprite sheets)
.claude/rules/  Internal contributor rules
.github/        CODEOWNERS, PR template, workflows
scripts/hooks/  Git hooks (pre-commit, pre-push)
wrangler.toml   Cloudflare Workers config
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
