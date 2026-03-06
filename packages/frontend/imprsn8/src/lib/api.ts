import type {
  User, InfluencerProfile, MonitoredAccount, ImpersonationReport,
  TakedownRequest, AgentDefinition, AgentRun, OverviewStats,
  ThreatStatus, ThreatSeverity, TakedownStatus, Platform,
  Analysis, AnalysisType, SocialProfile, ScorePoint, Campaign, AdminStats,
  HandleVariant, DataFeed,
} from "./types";

export type { User, Analysis, SocialProfile, ScorePoint, Campaign, HandleVariant, DataFeed };
export type AdminUser = User;
export type { AdminStats };

const BASE = "/api";

function getToken() { return localStorage.getItem("imprsn8_token"); }

function authHeaders(): HeadersInit {
  const t = getToken();
  return t
    ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  const json = await res.json() as { success: boolean; data?: T; error?: string };
  if (!json.success) throw new ApiError(res.status, String(json.error ?? "Request failed"));
  return json.data as T;
}

async function apiWithTotal<T>(path: string): Promise<{ data: T; total: number }> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  const json = await res.json() as { success: boolean; data?: T; total?: number; error?: string };
  if (!json.success) throw new Error(String(json.error ?? "Request failed"));
  return { data: json.data as T, total: json.total ?? 0 };
}

export const auth = {
  register: (email: string, password: string, invite_token?: string) =>
    api<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, ...(invite_token ? { invite_token } : {}) }),
    }),
  login: (email: string, password: string) =>
    api<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => api<User>("/auth/me"),
};

export const profile = {
  update: (data: { display_name?: string; bio?: string; username?: string }) =>
    api<User>("/profile", { method: "PATCH", body: JSON.stringify(data) }),
};

export const analyses = {
  list: () => api<Analysis[]>("/analyses"),
  start: (type: AnalysisType, input: string) =>
    api<Analysis>("/analyze", { method: "POST", body: JSON.stringify({ type, input_text: input }) }),
  scoreHistory: () => api<ScorePoint[]>("/analyses/score-history"),
};

export const socials = {
  list: () => api<SocialProfile[]>("/socials"),
  add: (platform: string, handle: string) =>
    api<SocialProfile>("/socials", { method: "POST", body: JSON.stringify({ platform, handle }) }),
  remove: (platform: string) =>
    api<{ message: string }>(`/socials/${platform}`, { method: "DELETE" }),
};

export const campaigns = {
  list: () => api<Campaign[]>("/campaigns"),
  create: (name: string, channel: string) =>
    api<Campaign>("/campaigns", { method: "POST", body: JSON.stringify({ name, channel }) }),
};

export const overview = {
  stats: (influencerId?: string) =>
    api<OverviewStats>(`/overview${influencerId ? `?influencer_id=${influencerId}` : ""}`),
};

export const influencers = {
  list: () => api<InfluencerProfile[]>("/influencers"),
  get: (id: string) => api<InfluencerProfile>(`/influencers/${id}`),
  create: (data: { display_name: string; handle: string; avatar_url?: string; tier?: string }) =>
    api<InfluencerProfile>("/influencers", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<InfluencerProfile>) =>
    api<InfluencerProfile>(`/influencers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  listVariants: (influencerId: string) => api<HandleVariant[]>(`/influencers/${influencerId}/variants`),
  addVariant: (influencerId: string, data: { platform: string; original_handle: string; variant_handle: string; variant_type: string }) =>
    api<HandleVariant>(`/influencers/${influencerId}/variants`, { method: "POST", body: JSON.stringify(data) }),
  deleteVariant: (influencerId: string, variantId: string) =>
    api<{ message: string }>(`/influencers/${influencerId}/variants/${variantId}`, { method: "DELETE" }),
};

export const accounts = {
  list: (params?: { influencer_id?: string; platform?: string; risk?: string }) => {
    const qs = new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => Boolean(v)) as [string, string][]);
    return api<MonitoredAccount[]>(`/accounts${qs.toString() ? `?${qs}` : ""}`);
  },
  add: (data: { influencer_id: string; platform: Platform; handle: string; profile_url?: string; is_verified?: number }) =>
    api<MonitoredAccount>("/accounts", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { risk_score?: number; risk_category?: string; follower_count?: number }) =>
    api<MonitoredAccount>(`/accounts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: string) =>
    api<{ message: string }>(`/accounts/${id}`, { method: "DELETE" }),
};

export const threats = {
  list: (params?: { influencer_id?: string; severity?: ThreatSeverity; status?: ThreatStatus; platform?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
    );
    return apiWithTotal<ImpersonationReport[]>(`/threats${qs.toString() ? `?${qs}` : ""}`);
  },
  get: (id: string) => api<ImpersonationReport>(`/threats/${id}`),
  create: (data: Partial<ImpersonationReport>) =>
    api<ImpersonationReport>("/threats", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { status?: ThreatStatus; severity?: ThreatSeverity; soc_note?: string }) =>
    api<ImpersonationReport>(`/threats/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

export const takedowns = {
  list: (params?: { influencer_id?: string; status?: TakedownStatus }) => {
    const qs = new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => Boolean(v)) as [string, string][]);
    return api<TakedownRequest[]>(`/takedowns${qs.toString() ? `?${qs}` : ""}`);
  },
  create: (data: { influencer_id: string; platform: string; suspect_handle: string; takedown_type: string; report_id?: string; evidence_json?: unknown[] }) =>
    api<TakedownRequest>("/takedowns", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { status?: TakedownStatus; case_ref?: string; resolution?: string }) =>
    api<TakedownRequest>(`/takedowns/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

export const agents = {
  list: () => api<AgentDefinition[]>("/agents"),
  runs: (params?: { agent_id?: string; influencer_id?: string; limit?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
    );
    return api<AgentRun[]>(`/agents/runs${qs.toString() ? `?${qs}` : ""}`);
  },
  trigger: (agentId: string, influencerId?: string) =>
    api<{ run_id: string; agent: string; status: string; message: string }>(
      `/agents/${agentId}/trigger`,
      { method: "POST", body: JSON.stringify({ influencer_id: influencerId }) }
    ),
};

export const admin = {
  stats: () => api<AdminStats>("/admin/stats"),
  users: (limit = 50, offset = 0) =>
    api<{ users: AdminUser[]; total: number }>(`/admin/users?limit=${limit}&offset=${offset}`),
  updateUser: (id: string, data: { role?: string; is_admin?: boolean; plan?: string; assigned_influencer_id?: string | null }) =>
    api<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

// ─── Invite types ─────────────────────────────────────────────
export interface InviteToken {
  id: string;
  token: string;
  influencer_id: string;
  influencer_name: string;
  role: string;
  email_hint: string | null;
  notes: string | null;
  expires_at: string;
  used_at: string | null;
  used_by_user_id: string | null;
  email_sent_at: string | null;
  created_at: string;
}
export interface InviteValidation {
  token: string;
  influencer_id: string;
  influencer_name: string;
  handle: string;
  avatar_url: string | null;
  role: string;
  email_hint: string | null;
  expires_at: string;
}
export interface DirectCreateResult {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  plan: string;
  assigned_influencer_id: string;
  generated_password: string;
}

export const invites = {
  validate: (token: string) => api<InviteValidation>(`/invites/${token}`),
  create: (data: {
    influencer_id: string;
    role?: "influencer" | "staff";
    email_hint?: string;
    notes?: string;
    expires_days?: number;
  }) => api<InviteToken>("/admin/invites", { method: "POST", body: JSON.stringify(data) }),
  list: (influencerId?: string) =>
    api<InviteToken[]>(`/admin/invites${influencerId ? `?influencer_id=${influencerId}` : ""}`),
  revoke: (id: string) => api<{ success: boolean }>(`/admin/invites/${id}`, { method: "DELETE" }),
  directCreate: (data: {
    email: string;
    influencer_id: string;
    role?: "influencer" | "staff";
    display_name?: string;
    password?: string;
  }) => api<DirectCreateResult>("/admin/users/direct-create", { method: "POST", body: JSON.stringify(data) }),
};

export const feeds = {
  list: () => api<DataFeed[]>("/feeds"),
  create: (data: {
    name: string; platform: string; api_key?: string; api_secret?: string;
    settings_json?: string; pull_interval_mins?: number;
  }) => api<DataFeed>("/feeds", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: {
    name?: string; api_key?: string; api_secret?: string;
    settings_json?: string; pull_interval_mins?: number; is_active?: number;
  }) => api<DataFeed>(`/feeds/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => api<{ message: string }>(`/feeds/${id}`, { method: "DELETE" }),
  trigger: (id: string) => api<{ data: DataFeed; meta: { threats_found: number; error?: string } }>(
    `/feeds/${id}/trigger`, { method: "POST" }
  ),
};
