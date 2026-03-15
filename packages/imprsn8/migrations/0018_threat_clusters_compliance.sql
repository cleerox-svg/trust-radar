-- Migration 0018: Threat clustering + compliance audit support
-- G-20: NEXUS threat clustering — groups related impersonation reports
-- G-22: WATCHDOG compliance audit — tracks HITL compliance gaps

-- Add cluster_id to impersonation_reports for NEXUS threat grouping
ALTER TABLE impersonation_reports ADD COLUMN cluster_id TEXT DEFAULT NULL;

-- Create index for efficient cluster lookups
CREATE INDEX IF NOT EXISTS idx_reports_cluster ON impersonation_reports(cluster_id)
  WHERE cluster_id IS NOT NULL;

-- Compliance audit log — WATCHDOG writes findings here
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
