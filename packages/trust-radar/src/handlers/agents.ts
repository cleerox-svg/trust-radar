import { json } from "../lib/cors";
import { executeAgent, resolveApproval, AGENT_DEFINITIONS } from "../lib/agentRunner";
import { agentModules, trustbotAgent } from "../agents";
import type { Env } from "../types";

// ─── Schedule labels for each agent ─────────────────────────────
const AGENT_SCHEDULES: Record<string, string> = {
  sentinel: "5m (event)",
  analyst: "every 15m",
  cartographer: "every 6h",
  strategist: "every 6h",
  observer: "daily",
};

// ─── List all agent definitions + their latest run ──────────────
export async function handleListAgents(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    // Run all aggregation queries in parallel
    const [latestRuns, runStats24h, outputStats24h, hourlyActivity, lastOutputTimes, avgDurations] = await Promise.all([
      // Latest run per agent
      env.DB.prepare(
        `SELECT agent_id, status, started_at, completed_at, duration_ms, error_message
         FROM agent_runs
         WHERE id IN (
           SELECT id FROM agent_runs r2
           WHERE r2.agent_id = agent_runs.agent_id
           ORDER BY r2.started_at DESC LIMIT 1
         )`
      ).all<{ agent_id: string; status: string; started_at: string; completed_at: string | null; duration_ms: number | null; error_message: string | null }>(),

      // Jobs + errors in last 24h per agent
      env.DB.prepare(
        `SELECT agent_id,
                COUNT(*) as jobs_24h,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as error_count_24h
         FROM agent_runs
         WHERE started_at >= datetime('now', '-1 day')
         GROUP BY agent_id`
      ).all<{ agent_id: string; jobs_24h: number; error_count_24h: number }>(),

      // Outputs in last 24h per agent
      env.DB.prepare(
        `SELECT agent_id,
                COUNT(*) as outputs_24h
         FROM agent_outputs
         WHERE created_at >= datetime('now', '-1 day')
         GROUP BY agent_id`
      ).all<{ agent_id: string; outputs_24h: number }>(),

      // Hourly activity (last 24h) for activity bar
      env.DB.prepare(
        `SELECT agent_id,
                CAST(strftime('%H', started_at) AS INTEGER) AS hour,
                COUNT(*) AS cnt
         FROM agent_runs
         WHERE started_at >= datetime('now', '-1 day')
         GROUP BY agent_id, hour`
      ).all<{ agent_id: string; hour: number; cnt: number }>(),

      // Last output time per agent
      env.DB.prepare(
        `SELECT agent_id, MAX(created_at) as last_output_at
         FROM agent_outputs
         GROUP BY agent_id`
      ).all<{ agent_id: string; last_output_at: string }>(),

      // Average duration per agent
      env.DB.prepare(
        `SELECT agent_id, AVG(duration_ms) as avg_duration_ms
         FROM agent_runs
         WHERE status = 'success'
         GROUP BY agent_id`
      ).all<{ agent_id: string; avg_duration_ms: number }>(),
    ]);

    // Build lookup maps
    const latestRunMap = new Map(latestRuns.results.map((r) => [r.agent_id, r]));
    const statsMap = new Map(runStats24h.results.map((r) => [r.agent_id, r]));
    const outputMap = new Map(outputStats24h.results.map((r) => [r.agent_id, r.outputs_24h]));
    const lastOutputMap = new Map(lastOutputTimes.results.map((r) => [r.agent_id, r.last_output_at]));
    const avgDurMap = new Map(avgDurations.results.map((r) => [r.agent_id, r.avg_duration_ms]));

    // Build hourly activity arrays (24 segments)
    const activityMap = new Map<string, number[]>();
    const currentHour = new Date().getUTCHours();
    for (const row of hourlyActivity.results) {
      if (!activityMap.has(row.agent_id)) {
        activityMap.set(row.agent_id, new Array(24).fill(0));
      }
      // Map hour to array index relative to current hour
      const idx = (row.hour - currentHour + 24) % 24;
      activityMap.get(row.agent_id)![idx] = row.cnt;
    }

    // Derive status from latest run
    function deriveStatus(agentName: string): string {
      const latest = latestRunMap.get(agentName);
      if (!latest) return "idle";
      if (latest.status === "failed") return "error";
      if (latest.status === "partial") return "degraded";
      // Check if run is recent enough to be "active"
      const lastRun = new Date(latest.started_at).getTime();
      const ageMs = Date.now() - lastRun;
      const twoHours = 2 * 60 * 60 * 1000;
      return ageMs < twoHours ? "active" : "idle";
    }

    const agents = AGENT_DEFINITIONS.map((def) => {
      const stats = statsMap.get(def.name);
      const latestRun = latestRunMap.get(def.name);
      return {
        agent_id: def.name,
        name: def.name,
        display_name: def.displayName,
        description: def.description,
        color: def.color,
        trigger: def.trigger,
        requiresApproval: def.requiresApproval,
        status: deriveStatus(def.name),
        schedule: AGENT_SCHEDULES[def.name] ?? "-",
        jobs_24h: stats?.jobs_24h ?? 0,
        outputs_24h: outputMap.get(def.name) ?? 0,
        error_count_24h: stats?.error_count_24h ?? 0,
        activity: activityMap.get(def.name) ?? new Array(24).fill(0),
        last_run_at: latestRun?.started_at ?? null,
        last_run_status: latestRun?.status ?? null,
        last_run_duration_ms: latestRun?.duration_ms ?? null,
        last_run_error: latestRun?.error_message ?? null,
        last_output_at: lastOutputMap.get(def.name) ?? null,
        avg_duration_ms: avgDurMap.get(def.name) ?? null,
      };
    });

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
    if (!mod) {
      console.log(`[triggerAgent] Agent "${agentName}" not found — available: ${Object.keys(agentModules).join(", ")}`);
      return json({ success: false, error: "Agent not found" }, 404, origin);
    }

    console.log(`[triggerAgent] Executing "${agentName}" (triggered by ${userId})`);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const result = await executeAgent(env, mod, body.input as Record<string, unknown> ?? {}, userId, "manual");
    console.log(`[triggerAgent] "${agentName}" completed: status=${result.status}, runId=${result.runId}${result.error ? `, error=${result.error}` : ""}`);

    return json({ success: true, data: result }, 200, origin);
  } catch (err) {
    console.error(`[triggerAgent] "${agentName}" threw:`, err);
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
