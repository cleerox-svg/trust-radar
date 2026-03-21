# API Reference

Trust Radar REST API — all endpoints served from Cloudflare Workers at `trustradar.ca`.

## Authentication

Authenticated endpoints require a JWT Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Obtain tokens via `POST /api/auth/login` or Google OAuth flow.

---

## Public Endpoints (No Auth Required)

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Enhanced health check (D1 latency, KV, stats) |
| `GET` | `/api/stats/public` | Public stats for social proof (cached 5min) |

### Scan

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/scan/report` | Free Brand Exposure Report (rate-limited: 5/hr per IP) |

**POST /api/scan/report**
```json
// Request
{ "domain": "example.com", "brand_name": "Example Inc" }

// Response: BrandExposureReport
{
  "domain": "example.com",
  "exposure_score": 72,
  "risk_level": "MODERATE",
  "email_security": { "grade": "B+", "spf": {...}, "dkim": {...}, "dmarc": {...} },
  "domain_risk": { "score": 65, "similar_domains_found": 12, "lookalikes": [...] },
  "threat_feeds": { "total_hits": 0, "phishtank": 0, "urlhaus": 0, "openphish": 0 },
  "social_presence": { "issues": 2, "platforms": [...] },
  "ai_assessment": "..."
}
```

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Register new account |
| `POST` | `/api/auth/login` | Login (returns JWT) |
| `GET` | `/api/auth/google` | Google OAuth initiation |
| `GET` | `/api/auth/callback` | Google OAuth callback |

---

## Authenticated Endpoints

### Brand Profiles

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/brand-profiles` | Create monitored brand |
| `GET` | `/api/brand-profiles` | List user's brands |
| `GET` | `/api/brand-profiles/:id` | Get brand detail |
| `PATCH` | `/api/brand-profiles/:id` | Update brand |
| `DELETE` | `/api/brand-profiles/:id` | Archive brand |
| `POST` | `/api/brand-profiles/:id/handles` | Add/update social handles |
| `GET` | `/api/brand-profiles/:id/handles` | Get handle status |

### Alerts

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/alerts` | List alerts (filterable by status, severity, brand) |
| `GET` | `/api/alerts/stats` | Alert breakdown by severity/status/type |
| `GET` | `/api/alerts/:id` | Get alert detail |
| `PATCH` | `/api/alerts/:id` | Update alert status (acknowledge, resolve, false_positive) |

### Social Monitoring

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/social/monitor` | Social monitoring overview |
| `GET` | `/api/social/monitor/:brandId` | Brand-specific monitoring results |
| `GET` | `/api/social/alerts` | Active impersonation alerts |
| `POST` | `/api/social/scan/:brandId` | Trigger immediate social scan |

### Lookalike Domains

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/lookalikes/:brandId` | List lookalike domains |
| `POST` | `/api/lookalikes/:brandId/generate` | Generate permutations |
| `PATCH` | `/api/lookalikes/:id` | Update status (benign, confirmed_threat) |
| `POST` | `/api/lookalikes/:brandId/scan` | Trigger immediate DNS check |

### Email Security

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/email-security/scan` | Scan domain email posture |
| `GET` | `/api/email-security/:domain` | Get cached email security results |

### Threats

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/threats` | List threats (filterable) |
| `GET` | `/api/threats/:id` | Get threat detail |

### AI Briefings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/briefing/latest` | Latest Observer briefing |
| `POST` | `/api/briefing/generate` | Trigger new briefing |

### Admin (Admin Role Required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/stats` | Platform-wide statistics |
| `POST` | `/api/admin/backfill-safe-domains` | Backfill safe domain allowlist |

---

## Response Format

All endpoints return consistent JSON:

```json
{
  "success": true,
  "data": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Description of the error"
}
```

## Rate Limiting

| Scope | Limit | Window |
|-------|-------|--------|
| Public scan | 5 requests | Per hour per IP |
| Authenticated API | 100 requests | Per minute per user |
| Brand creation | 10 requests | Per hour per user |

Rate limit headers are included in responses: `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
