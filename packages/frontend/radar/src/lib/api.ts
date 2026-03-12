const BASE = "/api";

export interface AiInsight { summary: string; explanation: string; recommendations: string[]; }

export interface ScanResult {
  id: string; url: string; domain: string; trust_score: number;
  risk_level: "safe" | "low" | "medium" | "high" | "critical";
  flags: Array<{ type: string; severity: string; detail: string }>;
  metadata: {
    ip?: string; country?: string; registrar?: string; registered_at?: string;
    ssl_valid?: boolean; ssl_expiry?: string;
    virustotal?: { malicious: number; suspicious: number; harmless: number; undetected: number };
    ai_insight?: AiInsight;
  };
  cached: boolean; created_at: string;
}
export type UserRole = "admin" | "analyst" | "customer";
export interface User { id: string; email: string; plan: string; role: UserRole; scans_used: number; scans_limit: number; is_admin: boolean; created_at: string; }
export interface DashboardStats { total_signals: number; processed: number; avg_trust: number; active_alerts: number; queue_depth: number; dead_letters: number; duplicates: number; stored: number; }
export interface Signal { id: string; captured_at: string; source: string; range_m: number; intensity_dbz: number; quality: number; tags: string[]; domain?: string; risk_level?: string; }
export interface SignalAlert { id: string; source: string; scan_ref?: string; domain?: string; quality: number; status: "open" | "acked" | "resolved"; created_at: string; }
export interface SourceMixItem { name: string; count: number; percentage: number; }
export interface TrendPoint { time: string; count: number; quality: number; }

// ─── Token helpers ────────────────────────────────────────────
const TOKEN_KEY = "radar_token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// ─── 401 / expiry callback ────────────────────────────────────
let _onUnauthorized: (() => void) | null = null;
export const onUnauthorized = (cb: () => void) => { _onUnauthorized = cb; };

function authHeaders(): HeadersInit {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } });
  if (res.status === 401) {
    clearToken();
    _onUnauthorized?.();
    throw new Error("Session expired. Please sign in again.");
  }
  const json = await res.json() as { success: boolean; data?: T; error?: string };
  if (!json.success) throw new Error((json.error as string) ?? "Request failed");
  return json.data as T;
}

export const auth = {
  register: (email: string, password: string, invite_token?: string) =>
    api<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, ...(invite_token ? { invite_token } : {}) }),
    }),
  login: (email: string, password: string) => api<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => api<User>("/auth/me"),
};
export const scans = {
  scan: (url: string) => api<ScanResult>("/scan", { method: "POST", body: JSON.stringify({ url }) }),
  history: (limit = 20, offset = 0) => api<ScanResult[]>(`/scan/history?limit=${limit}&offset=${offset}`),
};
export const dashboard = {
  stats: () => api<DashboardStats>("/dashboard/stats"),
  sources: () => api<SourceMixItem[]>("/dashboard/sources"),
  trend: () => api<TrendPoint[]>("/dashboard/trend"),
};
export const signals = {
  list: (limit = 20, offset = 0) => api<Signal[]>(`/signals?limit=${limit}&offset=${offset}`),
  ingest: (data: { source: string; domain: string; range_m: number; intensity_dbz: number; quality: number; tags: string[] }) =>
    api<Signal>("/signals", { method: "POST", body: JSON.stringify(data) }),
};
export const alerts = {
  list: () => api<SignalAlert[]>("/alerts"),
  ack: (id: string) => api<void>(`/alerts/${id}/ack`, { method: "POST" }),
};

export interface AdminUser { id: string; email: string; plan: string; scans_used: number; scans_limit: number; is_admin: boolean; created_at: string; }
export interface AdminStats { users: { total: number; pro: number; enterprise: number }; scans: { total: number; high_risk: number; avg_trust: number }; alerts: { total: number; open: number }; }
export interface AdminHealthData {
  status: "healthy" | "degraded" | "error";
  timestamp: string;
  environment: string;
  database: {
    status: "ok" | "error";
    response_ms: number;
    sqlite_version: string;
    journal_mode: string;
    encryption_at_rest: string;
    encryption_in_transit: string;
    last_migration: string;
    tables: { name: string; rows: number }[];
  };
  kv_cache: { status: string; binding: string };
  compliance: { data_residency: string; audit_logging: string; hitl_enforced: string };
}

export interface InviteToken {
  id: string; token: string; role: string; group_id: string | null;
  email_hint: string | null; notes: string | null; created_by: string;
  created_by_email?: string; expires_at: string; used_at: string | null;
  used_by_user_id: string | null; email_sent_at: string | null; created_at: string;
}

export const admin = {
  stats: () => api<AdminStats>("/admin/stats"),
  users: (limit = 50, offset = 0) => api<{ users: AdminUser[]; total: number }>(`/admin/users?limit=${limit}&offset=${offset}`),
  updateUser: (id: string, data: { plan?: string; scans_limit?: number; is_admin?: boolean }) =>
    api<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  health: () => api<AdminHealthData>("/admin/health"),
  sessionEvents: (params?: { user_id?: string; event_type?: string; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.user_id) sp.set("user_id", params.user_id);
    if (params?.event_type) sp.set("event_type", params.event_type);
    if (params?.limit) sp.set("limit", String(params.limit));
    return api<unknown[]>(`/admin/sessions?${sp}`);
  },
  forceLogout: (userId: string) =>
    api<{ message: string }>(`/admin/users/${userId}/force-logout`, { method: "POST" }),
};

export const invites = {
  validate: (token: string) => api<{ token: string; role: string; group_id: string | null; email_hint: string | null; expires_at: string }>(`/invites/${token}`),
  create: (data: { role?: string; group_id?: string; email_hint?: string; notes?: string; expires_days?: number }) =>
    api<InviteToken>("/admin/invites", { method: "POST", body: JSON.stringify(data) }),
  list: () => api<InviteToken[]>("/admin/invites"),
  revoke: (id: string) => api<{ message: string }>(`/admin/invites/${id}`, { method: "DELETE" }),
};

// ─── Feed types ─────────────────────────────────────────────
export interface FeedSchedule {
  id: string; feed_name: string; display_name: string; tier: number;
  category: string; url: string; interval_mins: number; enabled: number;
  requires_key: number; parser: string; last_run_at: string | null;
  last_success_at: string | null; last_error: string | null;
  consecutive_failures: number; circuit_open: number;
  total_runs: number; total_items: number; created_at: string;
  // New fields from 0015 migration
  description: string | null; settings_json: string | null;
  is_custom: number; created_by: string | null;
  last_items_new: number; provider_url: string | null;
  api_key_encrypted: string | null; api_secret_encrypted: string | null;
  // New fields from 0016 migration
  daily_limit: number | null;
}
export interface FeedIngestion {
  id: string; feed_name?: string; status: string; items_fetched: number;
  items_new: number; items_duplicate: number; items_error: number;
  threats_created: number; error: string | null; duration_ms: number;
  started_at: string; completed_at: string | null;
}
export interface FeedStatsData {
  summary: { total_feeds: number; enabled_feeds: number; circuit_open: number; total_runs: number; total_items: number };
  recentIngestions: FeedIngestion[];
  byTier: Array<{ tier: number; count: number; items: number; runs: number }>;
}

export interface FeedQuotaEntry {
  id: string;
  feed_name: string;
  display_name: string;
  daily_limit: number;
  calls_today: number;
}

export const feeds = {
  list: () => api<FeedSchedule[]>("/feeds"),
  get: (id: string) => api<{ feed: FeedSchedule; ingestions: FeedIngestion[] }>(`/feeds/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    api<FeedSchedule>(`/feeds/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  create: (data: Record<string, unknown>) =>
    api<FeedSchedule>("/feeds", { method: "POST", body: JSON.stringify(data) }),
  delete: (id: string) => api<void>(`/feeds/${id}`, { method: "DELETE" }),
  stats: () => api<FeedStatsData>("/feeds/stats"),
  jobs: (limit = 20) => api<FeedIngestion[]>(`/feeds/jobs?limit=${limit}`),
  quota: () => api<FeedQuotaEntry[]>("/feeds/quota"),
  trigger: (id: string) => api<unknown>(`/feeds/${id}/trigger`, { method: "POST" }),
  triggerAll: () => api<unknown>("/feeds/trigger-all", { method: "POST" }),
  triggerTier: (tier: number) => api<unknown>(`/feeds/trigger-tier/${tier}`, { method: "POST" }),
  resetCircuit: (id: string) => api<void>(`/feeds/${id}/reset`, { method: "POST" }),
};

// ─── Daily Briefing ──────────────────────────────────────────
export const dailyBriefing = {
  generate: (hours = 24, cached = false) =>
    api<{ id: string; title: string; body: string; summary: string; severity: string; created_at: string }>(
      `/briefings/generate?hours=${hours}${cached ? "&cached=true" : ""}`,
      { method: "POST" }
    ),
  history: (limit = 20) => api<Briefing[]>(`/briefings/history?limit=${limit}`),
};

// ─── Agent types ───────────────────────────────────────────
export interface AgentDefinition {
  name: string; displayName: string; description: string;
  color: string; trigger: string; requiresApproval: boolean;
  latestRun: AgentRun | null; runsToday: number;
}
export interface AgentRun {
  id: string; agent_name: string; status: string; trigger_type: string;
  triggered_by: string | null; items_processed: number; items_created: number;
  items_updated: number; duration_ms: number | null; model: string | null;
  tokens_used: number; error: string | null; output?: string;
  started_at: string | null; completed_at: string | null; created_at: string;
}
export interface AgentApproval {
  id: string; run_id: string; agent_name: string; action_type: string;
  description: string; details: string; status: string;
  decided_by: string | null; decision_note: string | null;
  expires_at: string | null; decided_at: string | null; created_at: string;
}
export interface AgentStatsData {
  summary: {
    total_runs: number; successes: number; failures: number; running: number;
    awaiting_approval: number; total_processed: number; total_created: number;
    total_tokens: number; avg_duration_ms: number;
  };
  pendingApprovals: number;
  todayByAgent: Array<{ agent_name: string; runs: number; successes: number }>;
}
export interface AgentDetail {
  agent: { name: string; displayName: string; description: string; color: string; trigger: string; requiresApproval: boolean };
  runs: AgentRun[];
  stats: {
    total_runs: number; successes: number; failures: number;
    total_processed: number; total_created: number; avg_duration_ms: number; total_tokens: number;
  };
}

export const agents = {
  list: () => api<AgentDefinition[]>("/agents"),
  get: (name: string) => api<AgentDetail>(`/agents/${name}`),
  stats: () => api<AgentStatsData>("/agents/stats"),
  runs: (limit = 50, agent?: string) => api<AgentRun[]>(`/agents/runs?limit=${limit}${agent ? `&agent=${agent}` : ""}`),
  trigger: (name: string, input?: Record<string, unknown>) =>
    api<{ runId: string; status: string; result: unknown; error?: string }>(`/agents/${name}/trigger`, { method: "POST", body: JSON.stringify({ input }) }),
  approvals: (status = "pending") => api<AgentApproval[]>(`/agents/approvals?status=${status}`),
  resolveApproval: (id: string, decision: "approved" | "rejected", note?: string) =>
    api<void>(`/agents/approvals/${id}/resolve`, { method: "POST", body: JSON.stringify({ decision, note }) }),
};

export const trustbot = {
  chat: (query: string) => api<{ response: string; context: Record<string, unknown>; runId: string }>("/trustbot/chat", { method: "POST", body: JSON.stringify({ query }) }),
};

// ─── Threat types ──────────────────────────────────────────
export interface Threat {
  id: string; type: string; title: string; severity: string; confidence: number;
  status: string; source: string; ioc_type: string | null; ioc_value: string | null;
  domain: string | null; ip_address: string | null; country_code: string | null;
  tags: string; first_seen: string; last_seen: string; created_at: string;
}
export interface ThreatStats {
  summary: Record<string, number>;
  last24h: Record<string, number>;
  byType: Array<{ type: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
  bySeverity: Array<{ severity: string; count: number }>;
  byCountry: Array<{ country_code: string; count: number }>;
}
export interface Briefing {
  id: string; title: string; summary: string | null; body: string | null;
  severity: string | null; category: string | null; status: string;
  generated_by: string | null; published_at: string | null; created_at: string;
}
export interface SocialIOC {
  id: string; platform: string; author: string; post_url: string;
  ioc_type: string; ioc_value: string; confidence: number; context: string | null;
  tags: string | null; verified: number; captured_at: string; created_at: string;
}

export const threats = {
  list: (params?: { limit?: number; severity?: string; type?: string; status?: string; q?: string }) => {
    const sp = new URLSearchParams();
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.severity) sp.set("severity", params.severity);
    if (params?.type) sp.set("type", params.type);
    if (params?.status) sp.set("status", params.status);
    if (params?.q) sp.set("q", params.q);
    return api<{ threats: Threat[]; total: number }>(`/threats?${sp}`);
  },
  stats: () => api<ThreatStats>("/threats/stats"),
  get: (id: string) => api<Threat>(`/threats/${id}`),
  update: (id: string, data: Record<string, unknown>) => api<void>(`/threats/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  enrichGeo: () => api<{ enriched: number; total: number }>("/threats/enrich-geo", { method: "POST" }),
};

export const briefings = {
  list: () => api<Briefing[]>("/briefings"),
  get: (id: string) => api<Briefing>(`/briefings/${id}`),
};

export const socialIocs = {
  list: (limit = 50, platform?: string) => api<{ iocs: SocialIOC[]; stats: Record<string, number> }>(`/social-iocs?limit=${limit}${platform ? `&platform=${platform}` : ""}`),
};

// ─── Investigation types ───────────────────────────────────
export interface InvestigationTicket {
  id: string; ticket_id: string; title: string; severity: string; status: string;
  priority: string; category: string; assignee_id: string | null;
  tags: string; sla_due_at: string | null; created_by: string;
  created_at: string; updated_at: string;
}
export interface ErasureAction {
  id: string; ticket_id: string | null; target_type: string; target_value: string;
  provider: string; provider_email: string | null; method: string; status: string;
  submitted_at: string | null; acknowledged_at: string | null; resolved_at: string | null;
  created_by: string; created_at: string;
}
export interface CampaignCluster {
  id: string; name: string; description: string | null; status: string;
  threat_count: number; confidence: number; first_seen: string;
  last_seen: string; created_at: string;
}

export const tickets = {
  list: (params?: { status?: string; severity?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.severity) sp.set("severity", params.severity);
    return api<{ tickets: InvestigationTicket[]; stats: Record<string, number> }>(`/tickets?${sp}`);
  },
  get: (id: string) => api<{ ticket: InvestigationTicket; evidence: unknown[]; erasures: ErasureAction[] }>(`/tickets/${id}`),
  create: (data: Record<string, unknown>) => api<{ id: string; ticketId: string }>("/tickets", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => api<void>(`/tickets/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  addEvidence: (ticketId: string, data: { capture_type: string; target_url?: string; content_hash?: string; storage_path?: string; metadata?: Record<string, unknown> }) =>
    api<{ id: string }>(`/tickets/${ticketId}/evidence`, { method: "POST", body: JSON.stringify(data) }),
};

export const erasures = {
  list: (status?: string) => api<{ erasures: ErasureAction[]; stats: Record<string, number> }>(`/erasures${status ? `?status=${status}` : ""}`),
  create: (data: Record<string, unknown>) => api<{ id: string }>("/erasures", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => api<void>(`/erasures/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

export const campaigns = {
  list: () => api<CampaignCluster[]>("/campaigns"),
};

// ─── Intel types ───────────────────────────────────────────
export interface BreachCheck {
  id: string; check_type: string; target: string; breach_name: string;
  breach_date: string | null; data_types: string | null; source: string;
  severity: string; resolved: number; checked_at: string; created_at: string;
}
export interface ATOEvent {
  id: string; email: string; event_type: string; ip_address: string | null;
  country_code: string | null; user_agent: string | null; risk_score: number;
  status: string; source: string; detected_at: string; created_at: string;
}
export interface EmailAuthReport {
  id: string; domain: string; report_type: string; result: string;
  source_ip: string | null; source_domain: string | null; alignment: string | null;
  details: string | null; report_date: string; created_at: string;
}
export interface CloudIncident {
  id: string; provider: string; service: string; title: string;
  description: string | null; severity: string; status: string;
  impact: string | null; source_url: string | null;
  started_at: string; resolved_at: string | null; created_at: string;
}

export const breaches = {
  list: (q?: string) => api<{ breaches: BreachCheck[]; stats: Record<string, number> }>(`/breaches${q ? `?q=${encodeURIComponent(q)}` : ""}`),
};

export const atoEvents = {
  list: (status?: string) => api<{ events: ATOEvent[]; stats: Record<string, number> }>(`/ato-events${status ? `?status=${status}` : ""}`),
  update: (id: string, status: string) => api<void>(`/ato-events/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
};

export const emailAuth = {
  list: (domain?: string) => api<{ reports: EmailAuthReport[]; stats: Record<string, number>; byType: Array<Record<string, unknown>> }>(`/email-auth${domain ? `?domain=${encodeURIComponent(domain)}` : ""}`),
};

export const cloudIncidents = {
  list: (provider?: string, activeOnly = false) => api<{ incidents: CloudIncident[]; stats: Record<string, number>; byProvider: Array<Record<string, unknown>> }>(`/cloud-incidents?${provider ? `provider=${provider}&` : ""}${activeOnly ? "active=true" : ""}`),
};

export const trustScores = {
  list: (domain?: string) => api<Array<{ id: string; domain: string; score: number; previous_score: number; delta: number; risk_level: string; measured_at: string }>>(`/trust-scores${domain ? `?domain=${encodeURIComponent(domain)}` : ""}`),
};

// ─── Data Export ──────────────────────────────────────────────
async function downloadCSV(path: string, filename: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const dataExport = {
  scans: (limit = 500) => downloadCSV(`/export/scans?limit=${limit}`, `scans-${Date.now()}.csv`),
  signals: (limit = 500) => downloadCSV(`/export/signals?limit=${limit}`, `signals-${Date.now()}.csv`),
  alerts: () => downloadCSV("/export/alerts", `alerts-${Date.now()}.csv`),
};
