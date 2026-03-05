import { json } from "../lib/cors";
import type { Env, OverviewStats, ImpersonationReport, AgentDefinition } from "../types";

export async function handleOverviewStats(
  request: Request, env: Env,
  userRole: string, assignedInfluencerId: string | null
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const influencerId = url.searchParams.get("influencer_id") ?? (
    (userRole === "influencer" || userRole === "staff") ? assignedInfluencerId : null
  );

  const whereClause = influencerId ? "AND influencer_id = ?" : "";
  const baseParams: unknown[] = influencerId ? [influencerId] : [];

  try {
    const [accountStats, threatStats, takedownStats, agentStats, recentThreatsRows, heartbeatRows] = await Promise.all([
      env.DB.prepare(
        `SELECT COUNT(*) as total, COUNT(DISTINCT platform) as platforms
         FROM monitored_accounts WHERE 1=1 ${whereClause}`
      ).bind(...baseParams).first<{ total: number; platforms: number }>(),

      env.DB.prepare(
        `SELECT COUNT(*) as total,
         SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical
         FROM impersonation_reports
         WHERE status NOT IN ('resolved','dismissed') ${whereClause}`
      ).bind(...baseParams).first<{ total: number; critical: number }>(),

      env.DB.prepare(
        `SELECT COUNT(*) as total,
         SUM(CASE WHEN status IN ('draft','submitted') THEN 1 ELSE 0 END) as urgent
         FROM takedown_requests
         WHERE status NOT IN ('resolved','rejected') ${whereClause}`
      ).bind(...baseParams).first<{ total: number; urgent: number }>().catch(() => ({ total: 0, urgent: 0 })),

      env.DB.prepare(
        "SELECT COUNT(*) as total, SUM(is_active) as active FROM agent_definitions"
      ).first<{ total: number; active: number }>(),

      env.DB.prepare(
        `SELECT ir.*, ip.display_name as influencer_name
         FROM impersonation_reports ir
         JOIN influencer_profiles ip ON ip.id = ir.influencer_id
         WHERE ir.status NOT IN ('resolved','dismissed') ${whereClause}
         ORDER BY CASE ir.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                  ir.detected_at DESC
         LIMIT 5`
      ).bind(...baseParams).all<ImpersonationReport>(),

      env.DB.prepare(`
        SELECT ad.*, ar_last.started_at as last_run_at, ar_last.status as last_run_status,
               COALESCE(td.runs_today, 0) as runs_today,
               COALESCE(td.threats_found_today, 0) as threats_found_today
        FROM agent_definitions ad
        LEFT JOIN agent_runs ar_last ON ar_last.id = (
          SELECT id FROM agent_runs WHERE agent_id = ad.id ORDER BY started_at DESC LIMIT 1
        )
        LEFT JOIN (
          SELECT agent_id, COUNT(*) as runs_today, SUM(threats_found) as threats_found_today
          FROM agent_runs WHERE started_at >= datetime('now', 'start of day')
          GROUP BY agent_id
        ) td ON td.agent_id = ad.id
        ORDER BY ad.name ASC
      `).all<AgentDefinition>(),
    ]);

    const stats: OverviewStats = {
      accounts_monitored: accountStats?.total ?? 0,
      platforms_count: accountStats?.platforms ?? 0,
      active_threats: threatStats?.total ?? 0,
      critical_threats: threatStats?.critical ?? 0,
      pending_takedowns: takedownStats?.total ?? 0,
      critical_takedowns: takedownStats?.urgent ?? 0,
      agents_active: agentStats?.active ?? 0,
      agents_total: agentStats?.total ?? 6,
      recent_threats: recentThreatsRows.results.map((r) => ({
        ...r,
        similarity_breakdown: typeof r.similarity_breakdown === "string"
          ? JSON.parse(r.similarity_breakdown as unknown as string)
          : r.similarity_breakdown,
      })),
      agent_heartbeat: heartbeatRows.results,
    };

    return json({ success: true, data: stats }, 200, origin);
  } catch (err) {
    console.error("Overview stats error:", err);
    return json({ success: true, data: {
      accounts_monitored: 0, platforms_count: 0,
      active_threats: 0, critical_threats: 0,
      pending_takedowns: 0, critical_takedowns: 0,
      agents_active: 0, agents_total: 6,
      recent_threats: [], agent_heartbeat: [],
    } as OverviewStats }, 200, origin);
  }
}

export async function handleAdminStats(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  const [userCount, influencerCount, threatCount, takedownCount] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as cnt FROM users").first<{ cnt: number }>(),
    env.DB.prepare("SELECT COUNT(*) as cnt FROM influencer_profiles WHERE active = 1").first<{ cnt: number }>(),
    env.DB.prepare("SELECT COUNT(*) as cnt FROM impersonation_reports WHERE status NOT IN ('resolved','dismissed')").first<{ cnt: number }>(),
    env.DB.prepare("SELECT COUNT(*) as cnt FROM takedown_requests WHERE status NOT IN ('resolved','rejected')").first<{ cnt: number }>(),
  ]);

  return json({ success: true, data: {
    users: userCount?.cnt ?? 0,
    influencers: influencerCount?.cnt ?? 0,
    active_threats: threatCount?.cnt ?? 0,
    pending_takedowns: takedownCount?.cnt ?? 0,
  } }, 200, origin);
}
