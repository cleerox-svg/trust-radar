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
export interface User { id: string; email: string; plan: string; scans_used: number; scans_limit: number; created_at: string; }
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
