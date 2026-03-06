// ─── Shared frontend types (mirrors backend types.ts) ─────────────────────

export type UserRole = "influencer" | "staff" | "soc" | "admin";

export interface User {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  plan: string;
  role: UserRole;
  is_admin: number;
  impression_score: number;
  total_analyses: number;
  assigned_influencer_id: string | null;
  created_at: string;
}

export interface InfluencerProfile {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  tier: string;
  active: number;
  monitored_count?: number;
  active_threats?: number;
  pending_takedowns?: number;
  created_at: string;
}

export type Platform =
  | "tiktok" | "instagram" | "x" | "youtube" | "facebook"
  | "linkedin" | "twitch" | "threads" | "snapchat" | "pinterest";

export type RiskCategory = "legitimate" | "suspicious" | "imposter" | "unscored";

export interface MonitoredAccount {
  id: string;
  influencer_id: string;
  influencer_name?: string;
  influencer_handle?: string;
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
  influencer_name?: string;
  influencer_handle?: string;
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
}

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
  influencer_name?: string;
  report_id: string | null;
  platform: string;
  suspect_handle: string;
  takedown_type: TakedownType;
  status: TakedownStatus;
  case_ref: string | null;
  evidence_json: EvidenceItem[];
  submitted_by: string | null;
  submitted_by_name?: string;
  submitted_at: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

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
  last_run_at: string | null;
  last_run_status: AgentRunStatus | null;
  runs_today: number;
  threats_found_today: number;
}

export interface AgentRun {
  id: string;
  agent_id: string;
  agent_name?: string;
  codename?: string;
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

export type AnalysisType = "bio" | "content" | "profile" | "portfolio";

export interface ScoreBreakdown {
  clarity: number;
  professionalism: number;
  consistency: number;
  impact: number;
}

export interface Analysis {
  id: string;
  type: AnalysisType;
  score: number;
  breakdown: ScoreBreakdown;
  strengths: string[];
  suggestions: string[];
  created_at: string;
}

export interface SocialProfile {
  id: string;
  platform: string;
  handle: string;
}

export interface ScorePoint {
  date: string;
  score: number;
}

export interface Campaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  impressions: number;
}

export type VariantType = "homoglyph" | "separator" | "suffix" | "prefix" | "swap" | "other";

export interface HandleVariant {
  id: string;
  influencer_id: string;
  platform: string;
  original_handle: string;
  variant_handle: string;
  variant_type: VariantType;
  is_active: number;
  created_at: string;
}

export interface AdminStats {
  users: number;
  influencers: number;
  active_threats: number;
  pending_takedowns: number;
  avg_impression_score: number;
  threats_by_platform: { platform: string; cnt: number }[];
  takedowns_by_type: { takedown_type: string; cnt: number }[];
  accounts_by_risk: { risk_category: string; cnt: number }[];
}

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
