#!/usr/bin/env bash
# Generate src/data/log.json from git history. Runs at build
# time (chained via `npm run build`) so /log.astro can read it
# without needing node:child_process at Cloudflare runtime.
#
# Output shape: array of { sha, tsIso, subject } for last 25
# non-merge commits on whatever branch is checked out.

set -euo pipefail

cd "$(dirname "$0")/.."

OUT=src/data/log.json
mkdir -p "$(dirname "$OUT")"

# Fallback if git is unavailable (shallow clone in some CI, no
# binary, etc): emit an empty array rather than failing the build.
if ! command -v git >/dev/null 2>&1 || ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "==> gen-log.sh: git unavailable, writing empty fixture"
  echo "[]" > "$OUT"
  exit 0
fi

# jq path — produces clean JSON without shell-escaping hazards.
# Each commit becomes {sha, tsIso, subject}. Last 25, skip merges.
git log --no-merges --pretty=format:'%h%x09%aI%x09%s' -n 25 \
  | python3 -c '
import json, sys
rows = []
for line in sys.stdin:
    line = line.rstrip("\n")
    if not line:
        continue
    parts = line.split("\t", 2)
    if len(parts) != 3:
        continue
    sha, ts, subject = parts
    rows.append({"sha": sha, "tsIso": ts, "subject": subject})
json.dump(rows, sys.stdout, indent=2)
' > "$OUT"

echo "==> gen-log.sh: wrote $(wc -l < "$OUT") lines to $OUT"
