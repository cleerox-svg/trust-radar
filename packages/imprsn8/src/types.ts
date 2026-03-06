export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  ASSETS: Fetcher;
  PROFILE_ASSETS: R2Bucket;
  JWT_SECRET: string;
  LRX_API_URL: string;
  LRX_API_KEY: string;
  ENVIRONMENT: string;
}

// ─── User / Auth ───────────────────────────────────────────────────────────
export type UserRole = "influencer" | "staff" | "soc" | "admin";
export type UserPlan = "free" | "pro" | "enterprise";

export interface User {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  plan: UserPlan;
  role: UserRole;
  is_admin: number;
  impression_score: number;
  total_analyses: number;
  assigned_influencer_id: string | null;
  created_at: string;
}

export interface JWTPayload {
  sub: string;
  email: string;
  plan: UserPlan;
  iat: number;
  exp: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── Influencer Profiles ───────────────────────────────────────────────────
export type InfluencerTier = "starter" | "pro" | "enterprise";

export interface InfluencerProfile {
  id: string;
  user_id: string | null;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  tier: InfluencerTier;
  active: number;
  created_at: string;
  updated_at: string;
  monitored_count?: number;
  active_threats?: number;
  pending_takedowns?: number;
}

// ─── Monitored Accounts ────────────────────────────────────────────────────
export type Platform =
  | "tiktok" | "instagram" | "x" | "youtube" | "facebook"
  | "linkedin" | "twitch" | "threads" | "snapchat" | "pinterest";

export type RiskCategory = "legitimate" | "suspicious" | "imposter" | "unscored";

export interface MonitoredAccount {
  id: string;
  influencer_id: string;
  platform: Platform;
  handle: string;
  profile_url: string | null;
  is_verified: number;
  follower_count: number | null;
  risk_score: number;
  risk_category: RiskCategory;
  bio_hash: string | null;
  avatar_hash: string | null;
  last_scanned_at: string | null;
  added_at: string;
  updated_at: string;
}

// ─── Impersonation Reports ─────────────────────────────────────────────────
export type ThreatType =
  | "full_clone" | "handle_squat" | "bio_copy" | "avatar_copy"
  | "scam_campaign" | "deepfake_media" | "unofficial_clips" | "voice_clone" | "other";

export type ThreatSeverity = "critical" | "high" | "medium" | "low";

export type ThreatStatus =
  | "new" | "investigating" | "confirmed" | "actioning" | "resolved" | "dismissed";

export type AgentName =
  | "SENTINEL" | "RECON" | "VERITAS" | "NEXUS" | "ARBITER" | "WATCHDOG" | "PHANTOM" | "manual";

export interface SimilarityBreakdown {
  bio_copy: number;
  avatar_match: number;
  posting_cadence: number;
  handle_distance: number;
}

export interface ImpersonationReport {
  id: string;
  influencer_id: string;
  platform: Platform;
  suspect_handle: string;
  suspect_url: string | null;
  suspect_followers: number | null;
  threat_type: ThreatType;
  severity: ThreatSeverity;
  similarity_score: number | null;
  similarity_breakdown: SimilarityBreakdown;
  status: ThreatStatus;
  ai_analysis: string | null;
  soc_note: string | null;
  detected_by: AgentName;
  detected_at: string;
  updated_at: string;
  influencer_name?: string;
  influencer_handle?: string;
}

// ─── Takedown Requests ─────────────────────────────────────────────────────
export type TakedownType = "dmca" | "impersonation" | "trademark" | "platform_tos" | "court_order";
export type TakedownStatus =
  | "draft" | "submitted" | "acknowledged" | "in_review" | "resolved" | "rejected";

export interface EvidenceItem {
  type: "screenshot" | "video" | "url_log" | "bio_copy" | "other";
  url?: string;
  description: string;
}

export interface TakedownRequest {
  id: string;
  influencer_id: string;
  report_id: string | null;
  platform: string;
  suspect_handle: string;
  takedown_type: TakedownType;
  status: TakedownStatus;
  case_ref: string | null;
  evidence_json: EvidenceItem[];
  submitted_by: string | null;
  submitted_at: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  influencer_name?: string;
  submitted_by_name?: string;
}

// ─── Agents ────────────────────────────────────────────────────────────────
export type AgentCategory = "detect" | "respond" | "monitor" | "analyze";
export type AgentRunStatus = "running" | "completed" | "failed" | "cancelled";

export interface AgentDefinition {
  id: string;
  name: AgentName;
  codename: string;
  description: string;
  category: AgentCategory;
  is_active: number;
  schedule_mins: number | null;
  config_json: Record<string, unknown>;
  created_at: string;
  last_run_at?: string | null;
  last_run_status?: AgentRunStatus | null;
  runs_today?: number;
  threats_found_today?: number;
}

export interface AgentRun {
  id: string;
  agent_id: string;
  agent_name?: string;
  influencer_id: string | null;
  influencer_name?: string | null;
  status: AgentRunStatus;
  items_scanned: number;
  threats_found: number;
  changes_detected: number;
  error_msg: string | null;
  started_at: string;
  completed_at: string | null;
}

// ─── Analysis ──────────────────────────────────────────────────────────────
export type AnalysisType = "bio" | "content" | "profile" | "portfolio";

export interface ScoreBreakdown {
  clarity: number;
  professionalism: number;
  consistency: number;
  impact: number;
}

// ─── Stats ─────────────────────────────────────────────────────────────────
export interface ActivityEvent {
  id: string;
  kind: "agent_run" | "threat_detected" | "threat_updated" | "takedown_created" | "takedown_updated";
  title: string;
  detail: string | null;
  severity: string | null;
  timestamp: string;
  influencer_name: string | null;
}

export interface OverviewStats {
  accounts_monitored: number;
  platforms_count: number;
  active_threats: number;
  critical_threats: number;
  pending_takedowns: number;
  critical_takedowns: number;
  agents_active: number;
  agents_total: number;
  last_agent_run_at: string | null;
  recent_threats: ImpersonationReport[];
  agent_heartbeat: AgentDefinition[];
  recent_activity: ActivityEvent[];
}

// ─── Data Feeds ────────────────────────────────────────────────────────────
export const FEED_PLATFORMS = [
  // Free
  "youtube", "twitch", "reddit", "tiktok", "bluesky",
  "mastodon", "rss", "facebook", "pinterest", "threads",
  // Low-cost
  "x_basic", "instagram_graph", "apify", "dataforseo",
  // Paid
  "x_pro", "brandwatch", "meltwater", "proxycurl", "mention",
] as const;

export type FeedPlatform = typeof FEED_PLATFORMS[number];
export type FeedTier = "free" | "low_cost" | "paid";
export type FeedStatus = "idle" | "running" | "success" | "error";

export interface DataFeed {
  id: string;
  name: string;
  platform: FeedPlatform;
  tier: FeedTier;
  api_key: string | null;       // masked in list responses
  api_secret: string | null;    // masked in list responses
  settings_json: string;
  pull_interval_mins: number;
  last_pulled_at: string | null;
  last_pull_status: FeedStatus | null;
  last_pull_error: string | null;
  pull_count: number;
  threats_found: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}
