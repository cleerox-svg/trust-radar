#!/usr/bin/env bash
# ─── AI Cost Optimization Diagnostic ─────────────────────────────
# Calls /api/internal/metrics/ai-cost-optimization and returns the
# focus-agent metrics + lever roster for the cost-reduction plan
# tracked in /root/.claude/plans/can-you-review-the-purring-pearl.md.
#
# Usage:
#   ./scripts/ai-cost-optimization.sh             # JSON
#   ./scripts/ai-cost-optimization.sh --summary   # short text summary
#
# Required env vars:
#   AVERROW_INTERNAL_SECRET — must match the worker secret
#   AVERROW_API_URL         — (optional) defaults to https://averrow.com
#
# Exit codes:
#   0  success (JSON on stdout)
#   1  missing secret
#   2  HTTP error

set -euo pipefail

MODE="${1:-json}"
API_URL="${AVERROW_API_URL:-https://averrow.com}"
SECRET="${AVERROW_INTERNAL_SECRET:-}"

if [ -z "$SECRET" ]; then
  echo "Error: AVERROW_INTERNAL_SECRET is not set." >&2
  echo "  export AVERROW_INTERNAL_SECRET=<your-internal-secret>" >&2
  exit 1
fi

ENDPOINT="${API_URL}/api/internal/metrics/ai-cost-optimization"

HTTP_CODE=$(curl -s -o /tmp/averrow-aicost-response.json -w "%{http_code}" \
  -H "Authorization: Bearer ${SECRET}" \
  "${ENDPOINT}" 2>/dev/null)

if [ "$HTTP_CODE" -ne 200 ]; then
  echo "Error: HTTP ${HTTP_CODE} from ${ENDPOINT}" >&2
  cat /tmp/averrow-aicost-response.json >&2
  rm -f /tmp/averrow-aicost-response.json
  exit 2
fi

if [ "$MODE" = "--summary" ] || [ "$MODE" = "-s" ]; then
  python3 -c "
import json, sys
r = json.load(open('/tmp/averrow-aicost-response.json'))
d = r.get('data', r)
print('=== AI Cost Optimization · ', d.get('generated_at',''), ' ===')
print()
for agent in d.get('focus_agents', []):
    m = d.get('windows', {}).get('24h', {}).get(agent, {})
    calls = m.get('calls', 0)
    cost = m.get('cost_usd', 0.0)
    inp = m.get('input_tokens', 0)
    out = m.get('output_tokens', 0)
    cpc = (cost / calls) if calls else 0.0
    ratio = (out / inp) if inp else 0.0
    print(f'{agent:<14} 24h: \${cost:.4f}  calls={calls:<5} cost/call=\${cpc:.5f}  out:in={ratio:.2f}')
print()
print('=== Levers ===')
for l in d.get('levers', []):
    status = l.get('status','planned')
    marker = '✓' if status == 'deployed' else ('…' if status == 'in_progress' else ' ')
    print(f'  [{marker}] {l.get(\"id\"):<10} {l.get(\"title\")}')
    print(f'        target={l.get(\"target_agent\"):<14} est=\${l.get(\"estimated_savings_usd_per_year\")}/yr')
" 2>&1
else
  cat /tmp/averrow-aicost-response.json
fi

rm -f /tmp/averrow-aicost-response.json
