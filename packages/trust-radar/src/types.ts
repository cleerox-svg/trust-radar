// Trust Radar v2 — Type Definitions

// ─── Cloudflare Worker Environment Bindings ─────────────────────
export interface Env {
  DB: D1Database;
  AUDIT_DB: D1Database;
  CACHE: KVNamespace;
  ASSETS: Fetcher;
  THREAT_PUSH_HUB: DurableObjectNamespace;
  // Environment variables
  ENVIRONMENT: string;
  // Secrets
  JWT_SECRET: string;
  ANTHROPIC_API_KEY: string;
  VIRUSTOTAL_API_KEY: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

// ─── Enums ──────────────────────────────────────────────────────
export type ThreatType =
  | "phishing"
  | "typosquatting"
  | "impersonation"
  | "malware_distribution"
  | "credential_harvesting";

export type ThreatStatus = "active" | "down" | "remediated";
export type CampaignStatus = "active" | "dormant" | "disrupted";
export type FeedHealthStatus = "healthy" | "degraded" | "down" | "disabled";
export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Grade = "A" | "B" | "C" | "D" | "F";

export type UserRole = "super_admin" | "admin" | "analyst" | "client";
export type UserStatus = "active" | "suspended" | "deactivated";
export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export type AgentId = "sentinel" | "analyst" | "cartographer" | "strategist" | "observer";
export type AgentOutputType = "insight" | "classification" | "correlation" | "score" | "trend_report";
export type RunStatus = "success" | "partial" | "failed";

export type LeadStatus = "new" | "contacted" | "qualified" | "proposal_sent" | "converted" | "closed_lost";
export type AuditOutcome = "success" | "failure" | "denied";

// ─── Core Data Models ───────────────────────────────────────────
export interface Brand {
  id: string;
  name: string;
  canonical_domain: string;
  sector: string | null;
  first_seen: string;
  threat_count: number;
  last_threat_seen: string | null;
}

export interface Threat {
  id: string;
  source_feed: string;
  threat_type: ThreatType;
  malicious_url: string | null;
  malicious_domain: string | null;
  target_brand_id: string | null;
  hosting_provider_id: string | null;
  ip_address: string | null;
  asn: string | null;
  country_code: string | null;
  lat: number | null;
  lng: number | null;
  registrar: string | null;
  first_seen: string;
  last_seen: string;
  status: ThreatStatus;
  confidence_score: number | null;
  campaign_id: string | null;
  ioc_value: string | null;
  severity: Severity | null;
  created_at: string;
}

export interface HostingProvider {
  id: string;
  name: string;
  asn: string | null;
  country: string | null;
  active_threat_count: number;
  total_threat_count: number;
  trend_7d: number;
  trend_30d: number;
  trend_90d: number;
  avg_response_time: number | null;
  reputation_score: number | null;
}

export interface Campaign {
  id: string;
  name: string;
  first_seen: string;
  last_seen: string;
  threat_count: number;
  brand_count: number;
  provider_count: number;
  attack_pattern: string | null;
  status: CampaignStatus;
}

// ─── Auth Models ────────────────────────────────────────────────
export interface User {
  id: string;
  google_sub: string | null;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  invited_by: string | null;
  created_at: string;
  last_login: string | null;
  last_active: string | null;
}

export interface Session {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

// ─── JWT ────────────────────────────────────────────────────────
export interface JWTPayload {
  sub: string;        // user ID
  email: string;
  role: UserRole;
  plan?: UserPlan;    // v1 compat — remove when v1 auth handlers are replaced
  iat: number;
  exp: number;
}

// ─── API Response ───────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── v1 Legacy Types (used by existing handlers — remove during v2 migration) ──
export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";
export type UserPlan = "free" | "pro" | "enterprise";

export interface ScanFlag {
  type: string;
  severity: RiskLevel;
  detail: string;
}

export interface ScanMetadata {
  ip?: string;
  country?: string;
  registrar?: string;
  registered_at?: string;
  ssl_valid?: boolean;
  ssl_expiry?: string;
  redirects?: string[];
  virustotal?: {
    malicious: number;
    suspicious: number;
    harmless: number;
    undetected: number;
  };
  ai_insight?: {
    summary: string;
    explanation: string;
    recommendations: string[];
  };
}

export interface ScanResult {
  id: string;
  url: string;
  domain: string;
  trust_score: number;
  risk_level: RiskLevel;
  flags: ScanFlag[];
  metadata: ScanMetadata;
  cached: boolean;
  created_at: string;
}
