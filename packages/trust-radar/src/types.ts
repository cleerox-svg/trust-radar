export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  JWT_SECRET: string;
  VIRUSTOTAL_API_KEY: string;
  LRX_API_URL: string;
  LRX_API_KEY: string;
  ENVIRONMENT: string;
}

export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";
export type UserPlan = "free" | "pro" | "enterprise";

export interface User {
  id: string;
  email: string;
  plan: UserPlan;
  scans_used: number;
  scans_limit: number;
  created_at: string;
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
