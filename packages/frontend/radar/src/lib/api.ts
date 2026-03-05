const BASE = "/api";

export interface ScanResult {
  id: string;
  url: string;
  domain: string;
  trust_score: number;
  risk_level: "safe" | "low" | "medium" | "high" | "critical";
  flags: Array<{ type: string; severity: string; detail: string }>;
  metadata: {
    ip?: string;
    country?: string;
    registrar?: string;
    registered_at?: string;
    ssl_valid?: boolean;
    ssl_expiry?: string;
    redirects?: string[];
    virustotal?: { malicious: number; suspicious: number; harmless: number; undetected: number };
  };
  cached: boolean;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  plan: string;
  scans_used: number;
  scans_limit: number;
  created_at: string;
}

function getToken() {
  return localStorage.getItem("radar_token");
}

function authHeaders(): HeadersInit {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  const json = await res.json() as { success: boolean; data?: T; error?: string };
  if (!json.success) throw new Error((json.error as string) ?? "Request failed");
  return json.data as T;
}

export const auth = {
  register: (email: string, password: string) =>
    api<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => api<User>("/auth/me"),
};

export const scans = {
  scan: (url: string) =>
    api<ScanResult>("/scan", { method: "POST", body: JSON.stringify({ url }) }),
  history: () => api<ScanResult[]>("/scan/history"),
};
