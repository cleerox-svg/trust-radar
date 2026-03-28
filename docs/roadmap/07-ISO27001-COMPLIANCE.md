# ISO 27001:2022 Compliance Plan

## Already Implemented ✅
| Control | Description | Evidence |
|---------|-------------|---------|
| A.8.2 | Privileged access | super_admin role, RBAC |
| A.8.3 | Access restriction | org-scoped queries, JWT |
| A.8.5 | Secure auth | Google OAuth, sessions |
| A.8.9 | Config management | wrangler.toml, 45 migrations |
| A.8.15 | Logging | audit_log in separate DB |
| A.8.16 | Monitoring | Agent monitoring, FC health |
| A.8.24 | Cryptography | HMAC-SHA256, AES-GCM |
| A.8.25 | Secure dev | GitHub PRs, CI, tsc strict |

## Gaps to Address 🔴
| Control | Gap | Action |
|---------|-----|--------|
| A.8.10 | Data deletion | GDPR erasure UI (table exists) |
| A.8.11 | Data masking | PII visible in some logs |
| A.6.8 | Incident reporting | No formal runbook |
| A.5.10 | Acceptable use | Need written policies |

## Evidence Vault (Platform Build)
Page: /v2/admin/compliance
- Control list with status badges
- Per control: evidence links, last reviewed, notes
- Export: full control mapping as PDF for auditors
- Gap analysis: prioritized unimplemented list

## Certification Pathway
Phase 1: Map controls, identify gaps (now)
Phase 2: Close technical gaps
Phase 3: Engage certification body (BSI/Bureau Veritas)
Phase 4: Stage 1 audit (document review)
Phase 5: Stage 2 audit (implementation)
Timeline: ~6-9 months to certificate
