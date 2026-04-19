#!/usr/bin/env bash
# Local dev bootstrap for warren.
#
# Wraps the wrangler D1 setup + migration apply + verify loop so a
# fresh clone (or post-`rm -rf .wrangler/state` reset) gets to a
# working `wrangler dev` state with one command.
#
# Surfaces the wrangler 4.83.0 silent-failure gotcha: `wrangler d1
# migrations apply --local --yes` reports success but DOES NOT
# actually create tables. The `--yes` skip-confirmation flag in
# wrangler 4.83+ has a regression where the underlying init step is
# also skipped. Workaround: pipe `y` to the interactive prompt.
#
# Verifies success by counting tables in sqlite_master after apply.
# Exits non-zero if the `signups` table is missing — caller can
# trust exit code 0 to mean "ready for wrangler dev".
#
# Discovered: dogfood Round 1 (2026-04-19), warren-dogfood-2026-04-19.md.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> warren dev bootstrap"

if [[ -d .wrangler/state ]]; then
  echo "==> existing .wrangler/state found"
  if [[ "${WARREN_BOOTSTRAP_RESET:-0}" == "1" ]]; then
    echo "==> WARREN_BOOTSTRAP_RESET=1 set — wiping .wrangler/state"
    rm -rf .wrangler/state
  else
    echo "==> leaving in place (set WARREN_BOOTSTRAP_RESET=1 to force-wipe)"
  fi
fi

echo "==> applying D1 migrations to local"
# Pipe 'y' to the interactive prompt instead of --yes flag
# (wrangler 4.83.0 --yes regression silently skips actual init).
echo y | npx wrangler d1 migrations apply warren --local

echo "==> verifying schema"
TABLE_COUNT=$(npx wrangler d1 execute warren --local --json \
  --command="SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='signups'" \
  | grep -oE '"n": *[0-9]+' | grep -oE '[0-9]+')

if [[ "${TABLE_COUNT}" != "1" ]]; then
  echo "❌ bootstrap FAILED — signups table missing (sqlite_master count: ${TABLE_COUNT})"
  echo "   try: WARREN_BOOTSTRAP_RESET=1 $0"
  exit 1
fi

echo "✅ bootstrap OK — signups table present"
echo ""
echo "Next: npx wrangler dev --port 8788"
