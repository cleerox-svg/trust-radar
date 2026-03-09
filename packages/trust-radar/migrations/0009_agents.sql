-- Migration: 0009_agents
-- AI agent execution framework: runs, approvals, and configuration

-- AI agent execution logs
CREATE TABLE IF NOT EXISTS agent_runs (
  id              TEXT PRIMARY KEY,
  agent_name      TEXT NOT NULL,                        -- triage, threat-hunt, campaign-correlator, takedown-orchestrator, etc.
  trigger_type    TEXT NOT NULL DEFAULT 'scheduled',    -- scheduled, event, manual, api
  triggered_by    TEXT,                                 -- user_id or system
  status          TEXT NOT NULL DEFAULT 'queued',       -- queued, running, success, failed, cancelled, timeout
  input           TEXT DEFAULT '{}',                    -- JSON: input parameters
  output          TEXT DEFAULT '{}',                    -- JSON: result summary
  error           TEXT,
  items_processed INTEGER NOT NULL DEFAULT 0,
  items_created   INTEGER NOT NULL DEFAULT 0,
  items_updated   INTEGER NOT NULL DEFAULT 0,
  duration_ms     INTEGER,
  model           TEXT,                                 -- AI model used (e.g., gpt-4o-mini)
  tokens_used     INTEGER NOT NULL DEFAULT 0,
  requires_approval INTEGER NOT NULL DEFAULT 0,         -- HITL flag
  started_at      TEXT,
  completed_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_name       ON agent_runs(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status     ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_trigger    ON agent_runs(trigger_type);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at ON agent_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_runs_approval   ON agent_runs(requires_approval) WHERE requires_approval = 1;

-- HITL (Human-in-the-Loop) approval queue
CREATE TABLE IF NOT EXISTS agent_approvals (
  id              TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL,                        -- FK to agent_runs.id
  agent_name      TEXT NOT NULL,
  action_type     TEXT NOT NULL,                        -- takedown, escalation, publish_briefing, auto_resolve
  description     TEXT NOT NULL,
  details         TEXT DEFAULT '{}',                    -- JSON: proposed action details
  status          TEXT NOT NULL DEFAULT 'pending',      -- pending, approved, rejected, expired
  decided_by      TEXT,                                 -- user_id of approver
  decision_note   TEXT,
  expires_at      TEXT,
  decided_at      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_approvals_status     ON agent_approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_agent      ON agent_approvals(agent_name);
CREATE INDEX IF NOT EXISTS idx_approvals_run_id     ON agent_approvals(run_id);
CREATE INDEX IF NOT EXISTS idx_approvals_created_at ON agent_approvals(created_at);
CREATE INDEX IF NOT EXISTS idx_approvals_pending    ON agent_approvals(status) WHERE status = 'pending';
