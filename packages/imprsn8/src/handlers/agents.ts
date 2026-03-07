import { json } from "../lib/cors";
import { runAgent } from "../lib/agentRunner";
import type { Env, AgentDefinition, AgentRun } from "../types";

export async function handleListAgents(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  const agents = await env.DB.prepare(`
    SELECT
      ad.*,
      ar_last.started_at as last_run_at,
      ar_last.status as last_run_status,
      COALESCE(today_stats.runs_today, 0) as runs_today,
      COALESCE(today_stats.threats_found_today, 0) as threats_found_today
    FROM agent_definitions ad
    LEFT JOIN agent_runs ar_last ON ar_last.id = (
      SELECT id FROM agent_runs
      WHERE agent_id = ad.id
      ORDER BY started_at DESC LIMIT 1
    )
    LEFT JOIN (
      SELECT agent_id,
        COUNT(*) as runs_today,
        SUM(threats_found) as threats_found_today
      FROM agent_runs
      WHERE started_at >= datetime('now', 'start of day')
      GROUP BY agent_id
    ) today_stats ON today_stats.agent_id = ad.id
    ORDER BY ad.name ASC
  `).all<AgentDefinition>();

  return json({ success: true, data: agents.results }, 200, origin);
}

export async function handleGetAgentRuns(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const agentId = url.searchParams.get("agent_id");
  const influencerId = url.searchParams.get("influencer_id");
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10));

  let query = `
    SELECT ar.*, ad.name as agent_name, ad.codename,
           ip.display_name as influencer_name
    FROM agent_runs ar
    JOIN agent_definitions ad ON ad.id = ar.agent_id
    LEFT JOIN influencer_profiles ip ON ip.id = ar.influencer_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (agentId) { query += " AND ar.agent_id = ?"; params.push(agentId); }
  if (influencerId) { query += " AND ar.influencer_id = ?"; params.push(influencerId); }

  query += " ORDER BY ar.started_at DESC LIMIT ?";
  params.push(limit);

  const rows = await env.DB.prepare(query).bind(...params).all<AgentRun & { codename: string }>();
  return json({ success: true, data: rows.results }, 200, origin);
}

export async function handleTriggerAgent(
  request: Request, env: Env,
  agentId: string, _userId: string
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => ({})) as { influencer_id?: string };

  const agent = await env.DB.prepare("SELECT * FROM agent_definitions WHERE id = ?").bind(agentId).first<AgentDefinition>();
  if (!agent) return json({ success: false, error: "Agent not found" }, 404, origin);
  if (!agent.is_active) return json({ success: false, error: "Agent is disabled" }, 400, origin);

  const runId = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO agent_runs (id, agent_id, influencer_id, status, started_at)
     VALUES (?, ?, ?, 'running', ?)`
  ).bind(runId, agentId, body.influencer_id ?? null, now).run();

  // Run the real agent implementation
  let result: { items_scanned: number; threats_found: number; changes_detected: number; error?: string };
  try {
    result = await runAgent(agent.name, env, body.influencer_id ?? null);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await env.DB.prepare(
      `UPDATE agent_runs SET status = 'failed', completed_at = datetime('now'),
       items_scanned = 0, threats_found = 0, changes_detected = 0, error_msg = ? WHERE id = ?`
    ).bind(error, runId).run();
    return json({ success: false, error }, 500, origin);
  }

  const finalStatus = result.error ? "failed" : "completed";
  await env.DB.prepare(
    `UPDATE agent_runs
     SET status = ?, completed_at = datetime('now'),
         items_scanned = ?, threats_found = ?, changes_detected = ?,
         error_msg = ?
     WHERE id = ?`
  ).bind(
    finalStatus,
    result.items_scanned,
    result.threats_found,
    result.changes_detected,
    result.error ?? null,
    runId,
  ).run();

  return json({
    success: true,
    data: {
      run_id: runId,
      agent: agent.name,
      status: finalStatus,
      items_scanned: result.items_scanned,
      threats_found: result.threats_found,
      changes_detected: result.changes_detected,
      message: result.error ?? `${agent.codename} completed successfully`,
    },
  }, 200, origin);
}

// ─── Scheduled agent runner (called from Cloudflare Cron) ────────────────────
// Runs all active agents that are due based on their schedule_mins cadence.
export async function runDueAgents(env: Env): Promise<void> {
  const due = await env.DB.prepare(
    `SELECT * FROM agent_definitions
     WHERE is_active = 1
       AND schedule_mins IS NOT NULL
       AND (
         -- Never run before
         NOT EXISTS (SELECT 1 FROM agent_runs WHERE agent_id = agent_definitions.id)
         OR
         -- Last run was more than schedule_mins ago
         (
           SELECT datetime(started_at, '+' || agent_definitions.schedule_mins || ' minutes')
           FROM agent_runs WHERE agent_id = agent_definitions.id
           ORDER BY started_at DESC LIMIT 1
         ) <= datetime('now')
       )`
  ).all<AgentDefinition>();

  for (const agent of due.results) {
    const runId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO agent_runs (id, agent_id, status, started_at) VALUES (?, ?, 'running', datetime('now'))`
    ).bind(runId, agent.id).run();

    let result: { items_scanned: number; threats_found: number; changes_detected: number; error?: string };
    try {
      result = await runAgent(agent.name, env, null);
    } catch (err) {
      result = { items_scanned: 0, threats_found: 0, changes_detected: 0, error: String(err) };
    }

    await env.DB.prepare(
      `UPDATE agent_runs
       SET status = ?, completed_at = datetime('now'),
           items_scanned = ?, threats_found = ?, changes_detected = ?, error_msg = ?
       WHERE id = ?`
    ).bind(
      result.error ? "failed" : "completed",
      result.items_scanned, result.threats_found, result.changes_detected,
      result.error ?? null, runId,
    ).run();
  }
}
