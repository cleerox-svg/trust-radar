#!/usr/bin/env bash
# ─── Averrow Cube Backfill ───────────────────────────────────────
# Loops POST /api/admin/cube-backfill until done=true.
#
# The endpoint streams NDJSON, processes oldest-first, and stops at
# its internal 25s wall-clock deadline returning resume_from. This
# script picks that cursor up and re-POSTs until the summary line
# returns done=true.
#
# Usage:
#   ./scripts/cube-backfill.sh                       # cube=status, days=30
#   ./scripts/cube-backfill.sh status 30
#   ./scripts/cube-backfill.sh all 7
#   ./scripts/cube-backfill.sh status 30 --dry-run
#
# Required env vars:
#   AVERROW_ADMIN_JWT  — admin (or super_admin) JWT access token. Grab
#                        from devtools after logging in to averrow.com:
#                        Application → Cookies → averrow.com → look for
#                        the auth token, or check localStorage/the
#                        Authorization header on any /api/admin/* call.
#   AVERROW_API_URL    — (optional) defaults to https://averrow.com
#
# Exit codes:
#   0  done (all hours processed)
#   1  missing JWT
#   2  HTTP error from the endpoint
#   3  malformed response (no summary line)

set -euo pipefail

CUBE="${1:-status}"
DAYS="${2:-30}"
DRY_RUN=""
if [ "${3:-}" = "--dry-run" ]; then
  DRY_RUN="&dry_run=true"
fi

API_URL="${AVERROW_API_URL:-https://averrow.com}"
JWT="${AVERROW_ADMIN_JWT:-}"

if [ -z "$JWT" ]; then
  echo "Error: AVERROW_ADMIN_JWT is not set." >&2
  echo "" >&2
  echo "Grab your admin JWT from a logged-in browser session:" >&2
  echo "  1. Open https://averrow.com while logged in as admin" >&2
  echo "  2. DevTools → Network → any /api/admin/* request → Authorization header" >&2
  echo "  3. Copy the value after 'Bearer '" >&2
  echo "" >&2
  echo "Then export it:" >&2
  echo "  export AVERROW_ADMIN_JWT='<token>'" >&2
  exit 1
fi

# Validate jq is available — we need it to parse NDJSON line-by-line.
if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed." >&2
  echo "Install it: brew install jq  /  apt-get install jq" >&2
  exit 1
fi

RESUME_FROM=""
PASS=0
TOTAL_HOURS=0
TOTAL_ROWS=0

echo "Cube backfill: cube=${CUBE} days=${DAYS}${DRY_RUN:+ (dry-run)}"
echo "Endpoint: ${API_URL}/api/admin/cube-backfill"
echo ""

while true; do
  PASS=$((PASS + 1))

  if [ -n "$RESUME_FROM" ]; then
    # URL-encode spaces in the hour bucket (safe enough for the SQLite
    # 'YYYY-MM-DD HH:00:00' format which only contains [0-9 -:])
    ENCODED=$(printf '%s' "$RESUME_FROM" | sed 's/ /%20/g')
    URL="${API_URL}/api/admin/cube-backfill?cube=${CUBE}&days=${DAYS}${DRY_RUN}&resume_from=${ENCODED}"
  else
    URL="${API_URL}/api/admin/cube-backfill?cube=${CUBE}&days=${DAYS}${DRY_RUN}"
  fi

  TMP=$(mktemp)
  trap 'rm -f "$TMP"' EXIT

  HTTP_CODE=$(curl -sS -o "$TMP" -w "%{http_code}" -X POST \
    -H "Authorization: Bearer ${JWT}" \
    "${URL}")

  if [ "$HTTP_CODE" -ne 200 ]; then
    echo "Error: HTTP ${HTTP_CODE} from ${URL}" >&2
    cat "$TMP" >&2
    rm -f "$TMP"
    exit 2
  fi

  # Parse summary line (last line of NDJSON output).
  SUMMARY=$(tail -n 1 "$TMP")
  if [ -z "$SUMMARY" ]; then
    echo "Error: empty response body" >&2
    rm -f "$TMP"
    exit 3
  fi

  # The summary line is the one carrying `done` — guard against malformed.
  DONE=$(echo "$SUMMARY" | jq -r '.done // empty')
  if [ -z "$DONE" ]; then
    echo "Error: no summary line in response" >&2
    cat "$TMP" >&2
    rm -f "$TMP"
    exit 3
  fi

  PASS_HOURS=$(echo "$SUMMARY" | jq -r '.total_hours // 0')
  PASS_ROWS=$(echo "$SUMMARY" | jq -r '.total_rows // 0')
  RESUME_FROM=$(echo "$SUMMARY" | jq -r '.resume_from // empty')

  TOTAL_HOURS=$((TOTAL_HOURS + PASS_HOURS))
  TOTAL_ROWS=$((TOTAL_ROWS + PASS_ROWS))

  printf 'pass %2d: hours=%-4s rows=%-8s done=%s%s\n' \
    "$PASS" "$PASS_HOURS" "$PASS_ROWS" "$DONE" \
    "${RESUME_FROM:+ resume_from=$RESUME_FROM}"

  rm -f "$TMP"

  if [ "$DONE" = "true" ]; then
    break
  fi

  if [ -z "$RESUME_FROM" ]; then
    echo "Error: done=false but no resume_from cursor — endpoint contract violation" >&2
    exit 3
  fi
done

echo ""
echo "Done. Total hours processed: ${TOTAL_HOURS}, total rows: ${TOTAL_ROWS}, passes: ${PASS}"
