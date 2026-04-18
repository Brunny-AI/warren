# PR Workflow (warren)

**Same bar as Brunny-AI/agent-os.** Adapted for a private
TypeScript/Astro repo on Cloudflare.

## Constraints

- **No direct commits to main.** Enforced by pre-commit hook
  and the GitHub ruleset on main.
- **PR size limit: 1000 lines changed.** Smaller PRs review
  faster and reduce blast radius.
- **Branch name:** `{agent}/{description}` (e.g.,
  `kai/scaffold-astro`, `scout/add-virtual-office`)
- **Commit format:** `[agent] verb: description`
  Verbs: add, fix, update, remove, refactor

## Review pipeline (5 mandatory steps)

### Step 1 — Privacy scan (pre-push hook)
Local hook scans for credentials, SSH keys, real-name leaks.
Server-side CI re-runs the same scan (CI workflow).

### Step 2 — Adversarial review
Run `/codex:adversarial-review` on the diff. Address all
findings using `/address-feedback`.

### Step 3 — Peer review meeting (bus, 2 sign-offs)
Open a `meeting-review-{branch-name}` channel on the bus.
Require sign-off from at least 2 agents (excluding author).
Record the meeting channel in the PR description.

### Step 4 — Open PR + wait for Gemini
Push, open PR using the template at
`.github/pull_request_template.md`. Gemini Code Assist auto-
fires on PR open / new commits. Wait for review.

### Step 5 — Code Owner APPROVE (Gemini-verification)
The non-author Code Owner verifies Gemini feedback was
addressed — not just the literal flagged line, but the same
class of issue across the touched files.

**Author replies on Gemini threads MUST be substantive.** No
"Gemini unresponsive" dismissals without explicit reasoning.

## Auto-merge

Author clicks "Enable auto-merge (squash)" on the PR. GitHub
waits for:
- Code Owner APPROVE (not author)
- All required status checks green (CodeQL, CI jobs)
- No commits pushed after the approval (stale reviews are
  dismissed automatically by the ruleset)

When all conditions hold, GitHub merges automatically.

## Git identity (per-commit)

```bash
# Per-repo, NOT global. Use GitHub noreply email for
# private repo commits to prevent committer-email leak even
# in private contexts (and for parity with agent-os).

git config user.name "Kai"
git config user.email \
  "275906642+brunny-kai@users.noreply.github.com"

# Scout:
git config user.name "Scout"
git config user.email \
  "275577941+brunny-scout@users.noreply.github.com"
```

## Git hooks

```bash
cp scripts/hooks/pre-commit .git/hooks/pre-commit
cp scripts/hooks/pre-push   .git/hooks/pre-push
chmod +x .git/hooks/pre-commit .git/hooks/pre-push
```

## Role permissions

| Action | founder | builder (scout) | builder (kai) | coordinator (alex) |
|---|---|---|---|---|
| Open PR | yes | yes | yes | no |
| Peer review (bus) | yes | yes | yes | yes |
| Code Owner APPROVE on GitHub | n/a | yes (non-author) | yes (non-author) | no |
| Merge | yes (admin) | auto-merge | auto-merge | no |

If both Code Owners are offline (rare), founder admin-merges
after coordinator (Alex) provides bus-channel approval.
