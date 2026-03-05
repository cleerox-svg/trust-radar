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

export type UserPlan = "free" | "pro" | "enterprise";
export type Platform = "linkedin" | "twitter" | "github" | "instagram" | "tiktok" | "youtube" | "website";
export type AnalysisType = "profile" | "content" | "bio" | "portfolio";

export interface User {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  plan: UserPlan;
  impression_score: number;
  total_analyses: number;
  created_at: string;
}

export interface SocialProfile {
  id: string;
  user_id: string;
  platform: Platform;
  handle: string;
  profile_url: string | null;
  verified: boolean;
  created_at: string;
}

export interface ScoreBreakdown {
  clarity: number;
  professionalism: number;
  consistency: number;
  impact: number;
}

export interface Analysis {
  id: string;
  user_id: string;
  type: AnalysisType;
  input_text?: string;
  input_url?: string;
  platform?: Platform;
  score: number;
  breakdown: ScoreBreakdown;
  suggestions: string[];
  strengths: string[];
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
