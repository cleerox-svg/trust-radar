# Tenant Cost Intelligence + Margin Dashboard

## Cost Model (Anthropic — current rates)
| Model | Input | Output |
|-------|-------|--------|
| claude-haiku-4-5 | $0.80/1M | $4.00/1M |
| claude-sonnet-4-20250514 | $3.00/1M | $15.00/1M |

## Current Spend (lifetime as of Mar 28)
| Agent | Tokens | Est. Cost |
|-------|--------|-----------|
| Cartographer | 1,131,508 | ~$0.91 |
| Analyst | 490,963 | ~$0.39 |
| Observer | 105,730 | ~$0.42 |
| Total | ~1.73M | ~$1.72 |

## Budget Alert (PRIORITY)
When remaining Anthropic credits reach $5.00:
- Trigger critical platform notification
- Send email to cleerox@gmail.com
- Fire once, mark sent in KV to prevent repeat
- Allow manual reset if balance topped up

## New Tables
```sql
CREATE TABLE org_usage_daily (
  org_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  ai_tokens_haiku INTEGER DEFAULT 0,
  ai_tokens_sonnet INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  estimated_cost_usd REAL DEFAULT 0,
  UNIQUE(org_id, date)
);
```

## Super Admin Cost Dashboard (/v2/admin/costs)
- Platform total cost this month
- Per-org: revenue vs cost vs margin %
- AI token burn rate chart (30d)
- Highest cost orgs table
- Alert: if org cost > 80% of plan price → flag
