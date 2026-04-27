#!/usr/bin/env bash
# ─── Averrow Cartographer Health ─────────────────────────────────
# Calls the /api/internal/cartographer-health endpoint and returns the
# full JSON response. Focused diagnostic for the Phase 0 enrichment
# pipeline — surfaces migration sanity, attempts distribution, queue /
# exhausted split, throughput, ip-api yield, and recent runs.
#
# Usage:
#   ./scripts/cartographer-health.sh
#
# Required env vars:
#   AVERROW_INTERNAL_SECRET  — the INTERNAL_SECRET from wrangler.toml / CF secrets
#   AVERROW_API_URL          — (optional) defaults to https://averrow.com
#
# Exit codes:
#   0  success (JSON on stdout)
#   1  missing secret
#   2  HTTP error

set -euo pipefail

API_URL="${AVERROW_API_URL:-https://averrow.com}"
SECRET="${AVERROW_INTERNAL_SECRET:-}"

if [ -z "$SECRET" ]; then
  echo "Error: AVERROW_INTERNAL_SECRET is not set." >&2
  echo "" >&2
  echo "Set it via:" >&2
  echo "  export AVERROW_INTERNAL_SECRET=<your-internal-secret>" >&2
  exit 1
fi

ENDPOINT="${API_URL}/api/internal/cartographer-health"

HTTP_CODE=$(curl -s -o /tmp/averrow-carto-response.json -w "%{http_code}" \
  -H "Authorization: Bearer ${SECRET}" \
  "${ENDPOINT}" 2>/dev/null)

if [ "$HTTP_CODE" -ne 200 ]; then
  echo "Error: HTTP ${HTTP_CODE} from ${ENDPOINT}" >&2
  cat /tmp/averrow-carto-response.json >&2
  rm -f /tmp/averrow-carto-response.json
  exit 2
fi

cat /tmp/averrow-carto-response.json
rm -f /tmp/averrow-carto-response.json
