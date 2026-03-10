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
export interface User { id: string; email: string; plan: string; scans_used: number; scans_limit: number; is_admin: boolean; created_at: string; }
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
  register: (email: string, password: string) => api<{ token: string; user: User }>("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) => api<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => api<User>("/auth/me"),
};
export const scans = {
  scan: (url: string) => api<ScanResult>("/scan", { method: "POST", body: JSON.stringify({ url }) }),
  history: (limit = 20) => api<ScanResult[]>(`/scan/history?limit=${limit}`),
};
export const dashboard = {
  stats: () => api<DashboardStats>("/dashboard/stats"),
  sources: () => api<SourceMixItem[]>("/dashboard/sources"),
  trend: () => api<TrendPoint[]>("/dashboard/trend"),
};
export const signals = { list: (limit = 20) => api<Signal[]>(`/signals?limit=${limit}`) };
export const alerts = {
  list: () => api<SignalAlert[]>("/alerts"),
  ack: (id: string) => api<void>(`/alerts/${id}/ack`, { method: "POST" }),
};

export interface AdminUser { id: string; email: string; plan: string; scans_used: number; scans_limit: number; is_admin: boolean; created_at: string; }
export interface AdminStats { users: { total: number; pro: number; enterprise: number }; scans: { total: number; high_risk: number; avg_trust: number }; alerts: { total: number; open: number }; }

export const admin = {
  stats: () => api<AdminStats>("/admin/stats"),
  users: (limit = 50, offset = 0) => api<{ users: AdminUser[]; total: number }>(`/admin/users?limit=${limit}&offset=${offset}`),
  updateUser: (id: string, data: { plan?: string; scans_limit?: number; is_admin?: boolean }) =>
    api<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

// ─── Feed types ─────────────────────────────────────────────
export interface FeedSchedule {
  id: string; feed_name: string; display_name: string; tier: number;
  category: string; url: string; interval_mins: number; enabled: number;
  requires_key: number; parser: string; last_run_at: string | null;
  last_success_at: string | null; last_error: string | null;
  consecutive_failures: number; circuit_open: number;
  total_runs: number; total_items: number; created_at: string;
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

export const feeds = {
  list: () => api<FeedSchedule[]>("/feeds"),
  get: (id: string) => api<{ feed: FeedSchedule; ingestions: FeedIngestion[] }>(`/feeds/${id}`),
  update: (id: string, data: { enabled?: boolean; interval_mins?: number }) =>
    api<void>(`/feeds/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  stats: () => api<FeedStatsData>("/feeds/stats"),
  jobs: (limit = 20) => api<FeedIngestion[]>(`/feeds/jobs?limit=${limit}`),
  trigger: (id: string) => api<unknown>(`/feeds/${id}/trigger`, { method: "POST" }),
  triggerAll: () => api<unknown>("/feeds/trigger-all", { method: "POST" }),
  triggerTier: (tier: number) => api<unknown>(`/feeds/trigger-tier/${tier}`, { method: "POST" }),
  resetCircuit: (id: string) => api<void>(`/feeds/${id}/reset`, { method: "POST" }),
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
