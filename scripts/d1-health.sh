#!/usr/bin/env bash
# ─── Averrow D1 Health ─────────────────────────────────────────────
# Database-level D1 diagnostic: size, per-table row counts, index
# inventory, schema version, FK enforcement, applied migrations,
# sample query latency.
#
# Usage:
#   ./scripts/d1-health.sh                    # default (no FK check)
#   ./scripts/d1-health.sh --check-fk         # also run foreign_key_check
#   ./scripts/d1-health.sh --top-n 30         # show top 30 tables
#
# Required env vars:
#   AVERROW_INTERNAL_SECRET  — internal API auth
#   AVERROW_API_URL          — (optional) defaults to https://averrow.com
#
# Exit codes:
#   0 success (JSON on stdout)
#   1 missing secret
#   2 HTTP error

set -euo pipefail

API_URL="${AVERROW_API_URL:-https://averrow.com}"
SECRET="${AVERROW_INTERNAL_SECRET:-}"

QS=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --check-fk) QS="${QS}${QS:+&}check_fk=true"; shift;;
    --top-n) QS="${QS}${QS:+&}top_n=$2"; shift 2;;
    *) echo "Unknown arg: $1" >&2; exit 1;;
  esac
done

if [ -z "$SECRET" ]; then
  echo "Error: AVERROW_INTERNAL_SECRET is not set." >&2
  echo "" >&2
  echo "Set it via:" >&2
  echo "  export AVERROW_INTERNAL_SECRET=<your-internal-secret>" >&2
  exit 1
fi

ENDPOINT="${API_URL}/api/internal/d1-health${QS:+?$QS}"

HTTP_CODE=$(curl -s -o /tmp/averrow-d1-response.json -w "%{http_code}" \
  -H "Authorization: Bearer ${SECRET}" \
  "${ENDPOINT}" 2>/dev/null)

if [ "$HTTP_CODE" -ne 200 ]; then
  echo "Error: HTTP ${HTTP_CODE} from ${ENDPOINT}" >&2
  cat /tmp/averrow-d1-response.json >&2
  rm -f /tmp/averrow-d1-response.json
  exit 2
fi

cat /tmp/averrow-d1-response.json
rm -f /tmp/averrow-d1-response.json
