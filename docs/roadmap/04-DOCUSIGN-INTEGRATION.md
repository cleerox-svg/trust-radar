# Docusign Integration Plan

## Three Use Cases

### 1. Takedown Authorization
Trigger: takedown_request draft → submitted
Flow: generate PDF evidence → Docusign eSignature →
      webhook on complete → update takedown status

### 2. License Agreements (MSA + Order Forms)
Trigger: Stripe checkout completes
Flow: pre-built MSA template → merge org data →
      send for signature → activate plan on complete

### 3. NDAs
Trigger: super admin initiates from Org → Documents tab
Flow: enter contact email → send NDA template →
      both parties sign → store in R2

## DB Changes
```sql
CREATE TABLE org_documents (
  id TEXT PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id),
  type TEXT NOT NULL, -- 'nda'|'msa'|'order_form'|'takedown_auth'
  docusign_envelope_id TEXT,
  status TEXT DEFAULT 'pending',
  signed_at TEXT,
  document_url TEXT,
  created_at TEXT DEFAULT datetime('now')
);
```

## Infrastructure
- Secrets: DOCUSIGN_ACCOUNT_ID, DOCUSIGN_ACCESS_TOKEN, DOCUSIGN_BASE_PATH
- Webhook: POST /api/docusign/webhook (HMAC verified)
- PDF generation: existing evidence assembly + R2 storage
