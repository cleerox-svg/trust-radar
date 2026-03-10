import { json } from "../lib/cors";
import type { Env } from "../types";

/**
 * KV-backed sliding window rate limiter for Cloudflare Workers.
 * Uses KV with TTL to track request counts per IP/key window.
 */

interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window size in seconds */
  windowSec: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  auth:    { limit: 10,  windowSec: 60 },   // 10 auth attempts per minute
  scan:    { limit: 30,  windowSec: 60 },   // 30 scans per minute
  api:     { limit: 120, windowSec: 60 },   // 120 API calls per minute
};

function getClientIP(request: Request): string {
  return request.headers.get("CF-Connecting-IP")
    ?? request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim()
    ?? "unknown";
}

export async function rateLimit(
  request: Request,
  env: Env,
  bucket: keyof typeof RATE_LIMITS = "api",
): Promise<Response | null> {
  const config = RATE_LIMITS[bucket];
  if (!config || !env.CACHE) return null;

  const ip = getClientIP(request);
  const windowKey = Math.floor(Date.now() / (config.windowSec * 1000));
  const key = `rl:${bucket}:${ip}:${windowKey}`;

  try {
    const current = parseInt(await env.CACHE.get(key) ?? "0", 10);

    if (current >= config.limit) {
      const origin = request.headers.get("Origin");
      return json(
        { success: false, error: "Too many requests. Please try again later." },
        429,
        origin,
      );
    }

    await env.CACHE.put(key, String(current + 1), { expirationTtl: config.windowSec * 2 });
  } catch {
    // If KV fails, allow the request through (fail-open)
  }

  return null;
}
