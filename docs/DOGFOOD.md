# Dogfood Warren

How to run a manual + scripted walkthrough of brunny.ai before founder review. Per [`.claude/rules/dogfood-with-playwright.md`](../../../.claude/rules/dogfood-with-playwright.md).

## Setup (one-time per machine)

```bash
git clone github-{your-ldap}:Brunny-AI/warren.git ~/warren-dogfood
cd ~/warren-dogfood
npm ci
npx playwright install --with-deps chromium
```

If you already have a warren clone, `cd` into it instead and `git pull origin main` + `npm ci`.

## Run

In one terminal, start the local server:

```bash
npx wrangler dev --port 8788
```

**Use `wrangler dev`, not `npm run dev`.** Wrangler runs the production-mode SSR via miniflare with the same Workers runtime that ships to prod. `npm run dev` (astro dev / Vite SSR) has a known optimization race with React + antd that errors on first signup-page render — fine for component iteration, broken for end-to-end testing.

In another terminal, run the harness:

```bash
# Walkthrough — primary user paths (chrome + signup happy/error)
npx playwright test scripts/dogfood/walkthrough.spec.ts

# A11y smoke — axe scan per page
npx playwright test scripts/dogfood/a11y.spec.ts

# All specs + headed mode (visible browser, slower, easier to eyeball)
npx playwright test --headed

# Exploratory: open the codegen recorder against your local server
npx playwright codegen http://localhost:8788
```

Failed tests get screenshots + traces under `playwright-report/`. Open the report in a browser:

```bash
npx playwright show-report
```

## Filing findings

After running, write your findings to:

```
workspaces/{your-ldap}/scratch/warren-dogfood-{YYYY-MM-DD}.md
```

Use this template:

```markdown
# Warren Dogfood: {date} — round {N} ({sha})

## Setup notes
- did the install path work?
- any deviations from DOGFOOD.md?

## Findings

### P0 — broken, blocks launch (must-fix same-shift)
- **[page]**: [bug + repro + screenshot path]

### P1 — visibly-wrong or significant UX gap (next PR)
- **[page]**: [observation + suggestion]

### P2 — polish, copy, minor UX (backlog)
- **[item]**

### Copy / editorial (Derek lane)
- **[page]**: [copy nit]

### Ideas (not bugs — opportunities)
- **[thing I'd try]**

## 30-second visitor verdict
> After 30 seconds on the homepage, can a cold visitor describe what this repo ships in one sentence?
- YES / NO
- if NO, escalate to **P0** per `.claude/rules/dogfood-with-playwright.md` §GTM-lens mandatory rubric

## One-line verdict
- ship / hold / block
```

Commit your findings file and ping kai on standup with the file path.

## Triage SLA (kai's obligation as harness owner)

- **P0**: fix in same shift OR file explicit deferral with founder-queue entry
- **P1**: open follow-up PR within 24h OR file FDQ if cross-cutting
- **P2**: add to repo backlog (task-engine entry)

Founder review only after dogfood pass is clean.

## Phased rounds

Per `.claude/rules/dogfood-with-playwright.md` §Phased rounds:

- **Round 1** (now): chrome + signup happy/error + a11y smoke. Pages still placeholder.
- **Round 2** (post PR-δ): 5 themed pages.
- **Round 3** (post PR-ε): virtual office Canvas.

Each round's specs scope to what's actually shippable at that moment — don't wait for the full product to run the first team pass.

## Per-agent lanes (per Scout's TSK-10 plan)

When the invitation goes out, each agent brings their role's lens:

- **alex** — CoS / compliance / admin lens
- **derek** — GTM / cold-visitor lens (S1-S5 scenarios pre-drafted in `workspaces/derek/scratch/warren-gtm-playwright-scripts-2026-04-19.md`)
- **kai** — builder / data-path lens (also harness owner)
- **scout** — product-direction / e2e lens
