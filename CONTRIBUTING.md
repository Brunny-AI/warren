# Contributing to warren

Setup walkthrough for new contributors (internal agents + external).

## TL;DR

```bash
git clone git@github.com:Brunny-AI/warren.git
cd warren
cp scripts/hooks/pre-commit .git/hooks/pre-commit
cp scripts/hooks/pre-push   .git/hooks/pre-push
chmod +x .git/hooks/pre-*
npm install
npm run dev
```

Open `http://localhost:4321`. You're in.

## Prerequisites

- Node 22.12+ (Astro 6 requires it)
- npm 10+
- GitHub account with SSH key + write access to `Brunny-AI/warren`

## Step 1 — SSH multi-account (skip if you only push as one identity)

If your machine pushes to GitHub as multiple identities (e.g.,
personal + work + agent personas), don't use the default
`~/.ssh/id_rsa` for warren — it'll commit under whichever identity
wins the SSH negotiation.

Instead:

```bash
ssh-keygen -t ed25519 -C "{your-handle}@brunny.ai" \
  -f ~/.ssh/id_ed25519_{your-handle}
```

Add to `~/.ssh/config`:

```
Host github-{your-handle}
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_{your-handle}
  IdentitiesOnly yes
```

Add the public key (`~/.ssh/id_ed25519_{your-handle}.pub`) to your GitHub account. Test:

```bash
ssh -T github-{your-handle}
# → "Hi {your-handle}!"
```

## Step 2 — Personal Access Token (only needed for `gh` CLI)

If you'll use `gh` CLI (PR ops, rulesets, etc.), generate a classic PAT at
`https://github.com/settings/tokens/new` with scopes:

- `repo` (full)
- `workflow` (CI changes)
- `read:org` (CODEOWNERS lookups)

Store it at a path that's gitignored (e.g., `~/.secrets/warren-pat` or in
your password manager). Source per-command:

```bash
export GH_TOKEN="$(cat ~/.secrets/warren-pat)"
gh pr list --repo Brunny-AI/warren
```

Don't run `gh auth login` if you maintain multiple GitHub identities — it
writes a global config that bleeds across them.

## Step 3 — Per-repo git config (mandatory if multi-identity)

After cloning, set the per-repo identity so commits attribute correctly:

```bash
git config user.name "{Your Display Name}"
git config user.email "{user-id}+{your-handle}@users.noreply.github.com"
```

Find your `user-id`:

```bash
gh api users/{your-handle} --jq .id
```

## Step 4 — First PR walkthrough

The 5-step pipeline (mandatory for every PR):

1. **Pre-push hook** — local privacy scan blocks credential/path leaks.
2. **Adversarial review** — run `/codex:adversarial-review` (or equivalent)
   on the diff before opening the PR.
3. **Peer review on bus** — for internal agents, open
   `review-{branch-name}` channel on the bus and get 2 sign-offs (excluding
   the author). Branch must be **pushed to origin** before requesting
   review (show-bytes rule).
4. **Open PR + Gemini auto-fires** — wait for Gemini Code Assist comments.
   `/gemini review` does NOT auto-re-fire on push; the author must comment
   it after every push to re-trigger.
5. **Code Owner APPROVE** — non-author Code Owner verifies Gemini feedback
   was addressed at *class level* (same kind of issue across the touched
   files), not just the literal flagged line.

Auto-merge: `gh pr merge --auto --squash --delete-branch` from the author.
Fires when CO APPROVE + all required checks green + no commits since
approval (stale reviews dismissed by ruleset).

## Step 5 — Common pitfalls

These have all bitten contributors before:

- **Pre-push hook self-scan bug.** A privacy-scanning hook will flag itself
  if its regex source contains the patterns it's looking for. The fix in
  this repo is `--exclude=pre-push` (basename, not `--exclude-dir=hooks` —
  BSD grep on macOS doesn't accept multi-component paths).
- **`npm ci` requires `package-lock.json`.** If you forget to commit the
  lockfile, CI's `npm ci` fails with `EUSAGE`. Run `npm install` locally
  before pushing the first time.
- **PR size budget excludes lockfiles** but not other large files. Don't
  vendor binaries, screenshots, or build artifacts.
- **Stacked PRs:** if PR A is the dependency of PR B, Gemini reads B
  against `main` (not against A's branch). It WILL flag B's correct-vs-
  post-A code as "critical." Code Owners reason about the dep chain
  before forwarding such findings.
- **Auto-merge does NOT auto-rebase** under strict status policy. If your
  PR sits BLOCKED + BEHIND main for >10 min, manually rebase + force-push
  (your APPROVE may survive if content is unchanged — empirical, not
  documented).

## Local development

```bash
npm install        # Once
npm run dev        # Astro dev server at :4321
npm run build      # Production build (Cloudflare Workers output)
npm run preview    # Preview the build locally
npm run typecheck  # Astro check (TypeScript + .astro files)
npm run lint       # ESLint (flat config in eslint.config.mjs)
```

## Style guide

`.gemini/styleguide.md` is the source of truth. Highlights:

- **Single quotes** for string literals; backticks for templates
- **`SCREAMING_SNAKE_CASE`** for module-level constants
- **`readonly`** on `Props` interface members that don't mutate
- **`--brunny-`** prefix on all CSS custom properties
- **Logical CSS properties** (`margin-block`, `padding-inline`) over
  physical ones
- **Sub-100-char** lines in `.astro` HTML
- **Lex-sorted imports** within each group

ESLint catches some; `astro check` catches more. Pre-commit hook runs
both.

## File ownership

| Path | Owner | Notes |
|------|-------|-------|
| `src/pages/*.astro` | Page-copy lane (currently Derek) | Voice |
| `src/components/*.astro`, `src/layouts/*.astro` | Scaffold lane (currently Kai) | Structure |
| `src/components/{virtual-office, ...}/` | React-island lane (Scout) | Pixel Agents fork integration |
| `wrangler.toml`, `astro.config.mjs`, deploy | Joint, Scout leads | Shared infra |
| `.github/workflows/*.yml` | Repo plumbing | Touch with care |

## Questions

Open an issue or post on the bus's `async` channel.
