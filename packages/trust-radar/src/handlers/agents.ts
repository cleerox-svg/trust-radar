import { json } from "../lib/cors";
import { executeAgent, resolveApproval, AGENT_DEFINITIONS } from "../lib/agentRunner";
import { agentModules, trustbotAgent } from "../agents";
import type { Env } from "../types";

// ─── List all agent definitions + their latest run ──────────────
export async function handleListAgents(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    // Get latest run per agent (v2 table)
    const latestRuns = await env.DB.prepare(
      `SELECT agent_id, id, status, records_processed, outputs_generated,
              duration_ms, error_message, started_at, completed_at
       FROM agent_runs
       WHERE id IN (
         SELECT id FROM agent_runs r2
         WHERE r2.agent_id = agent_runs.agent_id
         ORDER BY r2.started_at DESC LIMIT 1
       )`
    ).all();

    const runMap = new Map(latestRuns.results.map((r) => [(r as Record<string, unknown>).agent_id, r]));

    // Get run counts for today
    const todayRuns = await env.DB.prepare(
      `SELECT agent_id, COUNT(*) as runs_today
       FROM agent_runs
       WHERE started_at >= datetime('now', 'start of day')
       GROUP BY agent_id`
    ).all<{ agent_id: string; runs_today: number }>();

    const todayMap = new Map(todayRuns.results.map((r) => [r.agent_id, r.runs_today]));

    const agents = AGENT_DEFINITIONS.map((def) => ({
      ...def,
      latestRun: runMap.get(def.name) ?? null,
      runsToday: todayMap.get(def.name) ?? 0,
    }));

    return json({ success: true, data: agents }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Get agent detail with run history ──────────────────────────
export async function handleGetAgent(request: Request, env: Env, agentName: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const def = AGENT_DEFINITIONS.find((d) => d.name === agentName);
    if (!def) return json({ success: false, error: "Agent not found" }, 404, origin);

    const runs = await env.DB.prepare(
      `SELECT id, status, records_processed, outputs_generated,
              duration_ms, error_message, started_at, completed_at
       FROM agent_runs WHERE agent_id = ?
       ORDER BY started_at DESC LIMIT 50`
    ).bind(agentName).all();

    // Get agent outputs
    const outputs = await env.DB.prepare(
      `SELECT id, type, summary, severity, details, related_brand_ids,
              related_campaign_id, related_provider_ids, created_at
       FROM agent_outputs WHERE agent_id = ?
       ORDER BY created_at DESC LIMIT 20`
    ).bind(agentName).all();

    const stats = await env.DB.prepare(
      `SELECT
         COUNT(*) as total_runs,
         SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failures,
         SUM(records_processed) as total_processed,
         SUM(outputs_generated) as total_outputs,
         AVG(duration_ms) as avg_duration_ms
       FROM agent_runs WHERE agent_id = ?`
    ).bind(agentName).first();

    return json({
      success: true,
      data: { agent: def, runs: runs.results, outputs: outputs.results, stats },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Trigger an agent manually ──────────────────────────────────
export async function handleTriggerAgent(
  request: Request, env: Env, agentName: string, userId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const mod = agentModules[agentName];
    if (!mod) return json({ success: false, error: "Agent not found" }, 404, origin);

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const result = await executeAgent(env, mod, body.input as Record<string, unknown> ?? {}, userId, "manual");

    return json({ success: true, data: result }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Get run history across all agents ──────────────────────────
export async function handleAgentRuns(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const agentFilter = url.searchParams.get("agent");

    let query = `SELECT id, agent_id, status, records_processed, outputs_generated,
                        duration_ms, error_message, started_at, completed_at
                 FROM agent_runs`;

    if (agentFilter) {
      query += ` WHERE agent_id = ?`;
      const rows = await env.DB.prepare(query + " ORDER BY started_at DESC LIMIT ?")
        .bind(agentFilter, limit).all();
      return json({ success: true, data: rows.results }, 200, origin);
    }

    const rows = await env.DB.prepare(query + " ORDER BY started_at DESC LIMIT ?")
      .bind(limit).all();
    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Get latest agent outputs (insights, classifications, etc.) ─
export async function handleAgentOutputs(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "20", 10));
    const type = url.searchParams.get("type");
    const agentFilter = url.searchParams.get("agent");

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (type) { conditions.push("type = ?"); params.push(type); }
    if (agentFilter) { conditions.push("agent_id = ?"); params.push(agentFilter); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit);

    const rows = await env.DB.prepare(
      `SELECT id, agent_id, type, summary, severity, details,
              related_brand_ids, related_campaign_id, related_provider_ids, created_at
       FROM agent_outputs ${where}
       ORDER BY created_at DESC LIMIT ?`
    ).bind(...params).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Agent outputs by name ───────────────────────────────────────
export async function handleAgentOutputsByName(request: Request, env: Env, agentName: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "10", 10));

    const rows = await env.DB.prepare(
      `SELECT id, agent_id, type, summary, severity, details,
              related_brand_ids, related_campaign_id, related_provider_ids, created_at
       FROM agent_outputs WHERE agent_id = ?
       ORDER BY created_at DESC LIMIT ?`
    ).bind(agentName, limit).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Agent health metrics (hourly breakdown) ─────────────────────
export async function handleAgentHealth(request: Request, env: Env, agentName: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    // Get runs for last 24 hours bucketed by hour
    const hoursBack = 24;
    const runs: number[] = new Array(hoursBack).fill(0);
    const errors: number[] = new Array(hoursBack).fill(0);
    const outputs: number[] = new Array(hoursBack).fill(0);

    const rows = await env.DB.prepare(
      `SELECT
         CAST(strftime('%H', started_at) AS INTEGER) AS hour,
         duration_ms,
         status,
         outputs_generated
       FROM agent_runs
       WHERE agent_id = ? AND started_at >= datetime('now', '-24 hours')
       ORDER BY started_at ASC`
    ).bind(agentName).all();

    const currentHour = new Date().getUTCHours();
    for (const row of rows.results as { hour: number; duration_ms: number; status: string; outputs_generated: number }[]) {
      const idx = (row.hour - currentHour + hoursBack + hoursBack) % hoursBack;
      runs[idx] = (runs[idx] || 0) + (row.duration_ms || 0);
      if (row.status === "failed") errors[idx] = (errors[idx] ?? 0) + 1;
      outputs[idx] = (outputs[idx] ?? 0) + (row.outputs_generated || 0);
    }

    return json({ success: true, data: { runs, errors, outputs } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── HITL Approval Queue (legacy compat) ────────────────────────
export async function handleListApprovals(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "pending";

    const rows = await env.DB.prepare(
      `SELECT id, run_id, agent_name, action_type, description, details, status,
              decided_by, decision_note, expires_at, decided_at, created_at
       FROM radar_agent_approvals
       WHERE status = ?
       ORDER BY created_at DESC LIMIT 50`
    ).bind(status).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch {
    // Table may not exist in v2
    return json({ success: true, data: [] }, 200, origin);
  }
}

export async function handleResolveApproval(
  request: Request, env: Env, approvalId: string, userId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const body = await request.json() as { decision: "approved" | "rejected"; note?: string };
    if (!body.decision || !["approved", "rejected"].includes(body.decision)) {
      return json({ success: false, error: "Decision must be 'approved' or 'rejected'" }, 400, origin);
    }

    await resolveApproval(env, approvalId, body.decision, userId, body.note);
    return json({ success: true }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── TrustBot chat endpoint ─────────────────────────────────────
export async function handleTrustBotChat(
  request: Request, env: Env, userId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const body = await request.json() as { query: string };
    if (!body.query?.trim()) {
      return json({ success: false, error: "Query is required" }, 400, origin);
    }

    const result = await executeAgent(env, trustbotAgent, { query: body.query }, userId, "manual");

    return json({
      success: true,
      data: {
        response: (result.result?.output as Record<string, unknown>)?.response ?? "No response generated.",
        context: (result.result?.output as Record<string, unknown>)?.context ?? {},
        runId: result.runId,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Agent overview stats ───────────────────────────────────────
export async function handleAgentStats(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const summary = await env.DB.prepare(
      `SELECT
         COUNT(*) as total_runs,
         SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failures,
         SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
         SUM(records_processed) as total_processed,
         SUM(outputs_generated) as total_outputs,
         AVG(duration_ms) as avg_duration_ms
       FROM agent_runs`
    ).first();

    const todayRuns = await env.DB.prepare(
      `SELECT agent_id, COUNT(*) as runs, SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes
       FROM agent_runs WHERE started_at >= datetime('now', 'start of day')
       GROUP BY agent_id`
    ).all();

    // Latest outputs for insights panel
    const latestOutputs = await env.DB.prepare(
      `SELECT id, agent_id, type, summary, severity, created_at
       FROM agent_outputs ORDER BY created_at DESC LIMIT 10`
    ).all();

    return json({
      success: true,
      data: {
        summary,
        todayByAgent: todayRuns.results,
        latestOutputs: latestOutputs.results,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
