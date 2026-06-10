// Auth rate limiting (security audit 2026-06-10, finding H7).
//
// Fixed-window counters stored in the existing SESSIONS KV namespace.
// KV is eventually consistent, so concurrent bursts can slightly overshoot
// the limit — acceptable for brute-force throttling. Fails OPEN on KV errors
// (an outage must not lock everyone out of auth), but the degradation is
// logged so it is visible in tail logs.

import { corsHeaders } from "./cors";
import type { Env } from "../types";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSecs: number;
}

export async function checkRateLimit(
  env: Env,
  bucket: string,
  identifier: string,
  limit: number,
  windowSecs: number,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSecs);
  const key = `rl:${bucket}:${identifier}:${windowStart}`;

  try {
    const current = Number.parseInt((await env.SESSIONS.get(key)) ?? "0", 10) || 0;
    if (current >= limit) {
      return { allowed: false, retryAfterSecs: windowStart + windowSecs - now };
    }
    // KV minimum TTL is 60s; pad past the window boundary so the counter
    // never expires before the window does.
    await env.SESSIONS.put(key, String(current + 1), {
      expirationTtl: Math.max(windowSecs + 60, 60),
    });
    return { allowed: true, retryAfterSecs: 0 };
  } catch (e) {
    console.warn(
      "[rate-limit] KV error — failing open:",
      e instanceof Error ? e.message : String(e),
    );
    return { allowed: true, retryAfterSecs: 0 };
  }
}

/** Client IP for rate-limit identity. CF-Connecting-IP only — X-Forwarded-For is spoofable. */
export function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

export function rateLimitResponse(origin: string | null, retryAfterSecs: number): Response {
  return new Response(
    JSON.stringify({ success: false, error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.max(retryAfterSecs, 1)),
        ...corsHeaders(origin),
      },
    },
  );
}
