import type { Env } from "../types";

/** Context passed to every feed module's ingest function */
export interface FeedContext {
  env: Env;
  feedId: string;
  feedName: string;
  feedUrl: string;
  method: string;
  headers: Record<string, string>;
  parser: string;
  apiKey?: string;
}

/** Result returned by every feed module */
export interface FeedResult {
  itemsFetched: number;
  itemsNew: number;
  itemsDuplicate: number;
  itemsError: number;
  threatsCreated: number;
  error?: string;
}

/** A feed module implements a single ingest function */
export interface FeedModule {
  ingest(ctx: FeedContext): Promise<FeedResult>;
}

/** Row shape for inserting into the threats table */
export interface ThreatRow {
  id: string;
  type: string;           // phishing, malware, c2, ransomware, impersonation, scam, reputation
  title: string;
  description?: string;
  severity: string;       // critical, high, medium, low, info
  confidence: number;     // 0.0–1.0
  source: string;         // feed name
  source_ref?: string;    // external ID
  ioc_type?: string;      // domain, url, ip, hash, email
  ioc_value?: string;
  domain?: string;
  url?: string;
  ip_address?: string;
  country_code?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  created_by?: string;
}

/** Helper to generate a deterministic ID from source + IOC to prevent duplicates */
export function threatId(source: string, iocType: string, iocValue: string): string {
  // Simple hash-based ID — deterministic so INSERT OR IGNORE deduplicates
  const input = `${source}:${iocType}:${iocValue}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return `thr-${source}-${Math.abs(hash).toString(36)}`;
}
