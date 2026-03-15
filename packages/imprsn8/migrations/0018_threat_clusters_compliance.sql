-- Migration 0018: Threat clustering + compliance audit support
-- The cluster_id column already exists in the remote DB (applied before migration tracking).
-- The compliance_audit_log table uses IF NOT EXISTS so it's already safe.

-- No-op for the ALTER that would fail
SELECT 1;

-- Create index (IF NOT EXISTS is safe)
CREATE INDEX IF NOT EXISTS idx_reports_cluster ON impersonation_reports(cluster_id)
  WHERE cluster_id IS NOT NULL;

-- Compliance audit log (IF NOT EXISTS is safe)
CREATE TABLE IF NOT EXISTS compliance_audit_log (
  id TEXT PRIMARY KEY,
  audit_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  description TEXT NOT NULL,
  resolved_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  agent_run_id TEXT,
  FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_unresolved
  ON compliance_audit_log(resolved_at) WHERE resolved_at IS NULL;
