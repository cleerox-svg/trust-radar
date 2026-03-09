-- Migration: 0009_agents
-- AI agent execution framework: runs, approvals, and configuration
-- Prefixed with radar_ to avoid collision with imprsn8 agent_runs table

-- AI agent execution logs
CREATE TABLE IF NOT EXISTS radar_agent_runs (
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

CREATE INDEX IF NOT EXISTS idx_radar_agent_runs_name       ON radar_agent_runs(agent_name);
CREATE INDEX IF NOT EXISTS idx_radar_agent_runs_status     ON radar_agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_radar_agent_runs_trigger    ON radar_agent_runs(trigger_type);
CREATE INDEX IF NOT EXISTS idx_radar_agent_runs_created_at ON radar_agent_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_radar_agent_runs_approval   ON radar_agent_runs(requires_approval) WHERE requires_approval = 1;

-- HITL (Human-in-the-Loop) approval queue
CREATE TABLE IF NOT EXISTS radar_agent_approvals (
  id              TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL,                        -- FK to radar_agent_runs.id
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

CREATE INDEX IF NOT EXISTS idx_radar_approvals_status     ON radar_agent_approvals(status);
CREATE INDEX IF NOT EXISTS idx_radar_approvals_agent      ON radar_agent_approvals(agent_name);
CREATE INDEX IF NOT EXISTS idx_radar_approvals_run_id     ON radar_agent_approvals(run_id);
CREATE INDEX IF NOT EXISTS idx_radar_approvals_created_at ON radar_agent_approvals(created_at);
CREATE INDEX IF NOT EXISTS idx_radar_approvals_pending    ON radar_agent_approvals(status) WHERE status = 'pending';
