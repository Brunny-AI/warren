#!/usr/bin/env bash
# Pretty-print /api/admin/signup-stats.
#
# Resolves ADMIN_TOKEN from (in order):
#   1. $ADMIN_TOKEN environment variable
#   2. `wrangler secret get ADMIN_TOKEN` (prod deploy)
#
# Host defaults to production (brunny.ai); override with
# $WARREN_HOST for staging / local dev:
#   WARREN_HOST=http://localhost:8788 ./scripts/stats.sh
#
# Exit codes:
#   0   ok
#   1   usage / bad env
#   2   upstream http error (prints status + body)
#   3   no jq on PATH (required for pretty-print)

set -euo pipefail

HOST="${WARREN_HOST:-https://brunny.ai}"

if ! command -v jq >/dev/null 2>&1; then
  echo "stats.sh: requires jq on PATH (brew install jq)" >&2
  exit 3
fi

TOKEN="${ADMIN_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  if command -v wrangler >/dev/null 2>&1; then
    # `wrangler secret get` is not universally available; fall
    # back to `secret list` + manual prompt if missing.
    # Strip trailing whitespace + newlines — wrangler prints a
    # trailing LF that breaks `Authorization: Bearer <token>\n`
    # auth when interpolated directly.
    TOKEN="$(wrangler secret get ADMIN_TOKEN 2>/dev/null \
      | tr -d '[:space:]' || true)"
  fi
fi
if [[ -z "$TOKEN" ]]; then
  echo "stats.sh: ADMIN_TOKEN not set (env var or wrangler secret)" >&2
  exit 1
fi

URL="$HOST/api/admin/signup-stats"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

HTTP_CODE="$(curl -sS \
  -H "Authorization: Bearer $TOKEN" \
  -o "$TMP" \
  -w "%{http_code}" \
  "$URL")"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "stats.sh: HTTP $HTTP_CODE from $URL" >&2
  cat "$TMP" >&2
  echo >&2
  exit 2
fi

# Pretty-print matching the endpoint's JSON shape:
#   total, confirmed, pending_confirm, pending_over_24h,
#   last_signup_at, last_confirmed_at, by_source{}.
# Timestamps rendered as YYYY-MM-DD HH:MM:SS UTC for eyeball
# parsing; raw epoch also shown. by_source lines are tabular.
jq -r '
  def fmt_ts:
    if . == null then "(none)"
    else (. | strftime("%Y-%m-%d %H:%M:%S UTC")) + "  (\(.))"
    end;

  "warren — signup funnel @ \(now | strftime("%Y-%m-%d %H:%M:%S UTC"))",
  "",
  "total            : \(.total)",
  "confirmed        : \(.confirmed)",
  "pending_confirm  : \(.pending_confirm)",
  "pending_over_24h : \(.pending_over_24h)",
  "last_signup_at   : \(.last_signup_at | fmt_ts)",
  "last_confirmed_at: \(.last_confirmed_at | fmt_ts)",
  "",
  "by_source:",
  ((.by_source | to_entries | length) as $n |
    if $n == 0 then "  (none yet)" else empty end),
  (.by_source | to_entries | sort_by(-.value) | .[] |
    # Pad key to at least 16 chars; clamp negative pad to 0
    # so labels longer than 16 chars still render (no trailing
    # column alignment for those rows — acceptable).
    .key as $k |
    (if ($k | length) < 16
     then $k + (" " * (16 - ($k | length)))
     else $k + " " end) as $padded |
    "  \($padded) \(.value)")
' "$TMP"
