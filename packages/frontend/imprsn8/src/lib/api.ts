const BASE = "/api";

export interface User {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  plan: string;
  impression_score: number;
  total_analyses: number;
  is_admin: boolean;
  created_at: string;
}

export interface Analysis {
  id: string;
  type: "profile" | "content" | "bio" | "portfolio";
  input_text?: string;
  input_url?: string;
  platform?: string;
  score: number;
  breakdown: { clarity: number; professionalism: number; consistency: number; impact: number };
  suggestions: string[];
  strengths: string[];
  created_at: string;
}

export interface SocialProfile {
  id: string;
  platform: string;
  handle: string;
  profile_url: string | null;
  verified: boolean;
  created_at: string;
}

export interface ScorePoint {
  date: string;
  score: number;
}

export interface Campaign {
  id: string;
  name: string;
  channel: string;
  status: "active" | "paused" | "done";
  reach: number;
  impressions: number;
  conversions: number;
  started_at: string;
  created_at: string;
}

export interface AdminUser { id: string; email: string; username: string | null; display_name: string | null; plan: string; impression_score: number; total_analyses: number; is_admin: boolean; created_at: string; }
export interface AdminStats { users: { total: number; pro: number; enterprise: number; avg_impression_score: number }; analyses: { total: number; avg_score: number }; }

function getToken() {
  return localStorage.getItem("imprsn8_token");
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

export const profile = {
  update: (data: Partial<Pick<User, "display_name" | "bio" | "username">>) =>
    api<User>("/profile", { method: "PATCH", body: JSON.stringify(data) }),
};

export const analyses = {
  start: (type: Analysis["type"], input: string, platform?: string) =>
    api<Analysis>("/analyze", {
      method: "POST",
      body: JSON.stringify(type === "profile" ? { type, input_url: input, platform } : { type, input_text: input }),
    }),
  list: () => api<Analysis[]>("/analyses"),
  scoreHistory: () => api<ScorePoint[]>("/score/history"),
};

export const socials = {
  list: () => api<SocialProfile[]>("/social"),
  add: (platform: string, handle: string, profile_url?: string) =>
    api<SocialProfile>("/social", { method: "POST", body: JSON.stringify({ platform, handle, profile_url }) }),
  remove: (platform: string) =>
    api<{ message: string }>(`/social/${platform}`, { method: "DELETE" }),
};

export const campaigns = {
  list: () => api<Campaign[]>("/campaigns"),
  create: (name: string, channel: string) =>
    api<Campaign>("/campaigns", { method: "POST", body: JSON.stringify({ name, channel }) }),
};

export const admin = {
  stats: () => api<AdminStats>("/admin/stats"),
  users: (limit = 50, offset = 0) => api<{ users: AdminUser[]; total: number }>(`/admin/users?limit=${limit}&offset=${offset}`),
  updateUser: (id: string, data: { plan?: string; is_admin?: boolean }) =>
    api<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};
