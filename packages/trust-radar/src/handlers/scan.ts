import { z } from "zod";
import { json } from "../lib/cors";
import type { Env, ScanResult, ScanFlag, ScanMetadata, RiskLevel } from "../types";

const ScanSchema = z.object({
  url: z.string().url().max(2048),
});

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function scoreToRisk(score: number): RiskLevel {
  if (score >= 80) return "safe";
  if (score >= 60) return "low";
  if (score >= 40) return "medium";
  if (score >= 20) return "high";
  return "critical";
}

async function checkVirusTotal(
  url: string,
  apiKey: string
): Promise<ScanMetadata["virustotal"] | null> {
  try {
    const encoded = btoa(url).replace(/=/g, "");
    const resp = await fetch(`https://www.virustotal.com/api/v3/urls/${encoded}`, {
      headers: { "x-apikey": apiKey },
    });

    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      data: { attributes: { last_analysis_stats: Record<string, number> } };
    };
    const stats = data.data.attributes.last_analysis_stats;

    return {
      malicious: stats["malicious"] ?? 0,
      suspicious: stats["suspicious"] ?? 0,
      harmless: stats["harmless"] ?? 0,
      undetected: stats["undetected"] ?? 0,
    };
  } catch {
    return null;
  }
}

async function runScan(url: string, env: Env): Promise<Omit<ScanResult, "id" | "created_at">> {
  const domain = extractDomain(url);
  const flags: ScanFlag[] = [];
  const metadata: ScanMetadata = {};
  let score = 100;

  // SSL check
  const isHttps = url.startsWith("https://");
  if (!isHttps) {
    score -= 25;
    flags.push({ type: "no_ssl", severity: "high", detail: "Site does not use HTTPS" });
  }
  metadata.ssl_valid = isHttps;

  // VirusTotal check
  if (env.VIRUSTOTAL_API_KEY) {
    const vt = await checkVirusTotal(url, env.VIRUSTOTAL_API_KEY);
    if (vt) {
      metadata.virustotal = vt;
      if (vt.malicious > 0) {
        score -= Math.min(50, vt.malicious * 10);
        flags.push({
          type: "malicious_url",
          severity: "critical",
          detail: `Flagged as malicious by ${vt.malicious} security vendors`,
        });
      }
      if (vt.suspicious > 0) {
        score -= Math.min(20, vt.suspicious * 5);
        flags.push({
          type: "suspicious_url",
          severity: "medium",
          detail: `Flagged as suspicious by ${vt.suspicious} security vendors`,
        });
      }
    }
  }

  // IP-only domain check
  if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
    score -= 15;
    flags.push({ type: "ip_domain", severity: "medium", detail: "URL uses an IP address instead of a domain name" });
  }

  // Typosquatting check (common brand names with subtle variations)
  const suspiciousPatterns = [
    /paypa[l1]|p4ypal/i,
    /g[o0]{2}gle|googl[e3]/i,
    /amaz[o0]n|am4zon/i,
    /micr[o0]s[o0]ft/i,
    /app1e|appl[e3]/i,
  ];
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(domain)) {
      score -= 30;
      flags.push({
        type: "typosquatting",
        severity: "high",
        detail: "Domain resembles a well-known brand (possible phishing)",
      });
      break;
    }
  }

  score = Math.max(0, Math.min(100, score));
  const risk_level = scoreToRisk(score);

  return {
    url,
    domain,
    trust_score: score,
    risk_level,
    flags,
    metadata,
    cached: false,
  };
}

export async function handleScan(
  request: Request,
  env: Env,
  userId?: string
): Promise<Response> {
  const origin = request.headers.get("Origin");

  const body = await request.json().catch(() => null);
  const parsed = ScanSchema.safeParse(body);

  if (!parsed.success) {
    return json({ success: false, error: "Invalid URL" }, 400, origin);
  }

  const { url } = parsed.data;
  const domain = extractDomain(url);

  // Check cache
  const cached = await env.DB.prepare(
    "SELECT * FROM domain_cache WHERE domain = ? AND expires_at > datetime('now')"
  )
    .bind(domain)
    .first<{
      domain: string;
      trust_score: number;
      risk_level: string;
      flags: string;
      metadata: string;
    }>();

  if (cached) {
    const result: ScanResult = {
      id: crypto.randomUUID(),
      url,
      domain: cached.domain,
      trust_score: cached.trust_score,
      risk_level: cached.risk_level as RiskLevel,
      flags: JSON.parse(cached.flags),
      metadata: JSON.parse(cached.metadata),
      cached: true,
      created_at: new Date().toISOString(),
    };

    if (userId) {
      await env.DB.prepare(
        "INSERT INTO scans (id, user_id, url, domain, trust_score, risk_level, flags, metadata, cached) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)"
      )
        .bind(result.id, userId, url, domain, result.trust_score, result.risk_level, cached.flags, cached.metadata)
        .run();
    }

    return json({ success: true, data: result }, 200, origin);
  }

  // Run fresh scan
  const scanData = await runScan(url, env);
  const id = crypto.randomUUID();
  const flagsJson = JSON.stringify(scanData.flags);
  const metaJson = JSON.stringify(scanData.metadata);
  const now = new Date().toISOString();

  // Store result
  if (userId) {
    await env.DB.prepare(
      "INSERT INTO scans (id, user_id, url, domain, trust_score, risk_level, flags, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(id, userId, url, domain, scanData.trust_score, scanData.risk_level, flagsJson, metaJson)
      .run();
  }

  // Cache the result for 1 hour
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO domain_cache (domain, trust_score, risk_level, flags, metadata, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(domain) DO UPDATE SET
       trust_score = excluded.trust_score,
       risk_level = excluded.risk_level,
       flags = excluded.flags,
       metadata = excluded.metadata,
       expires_at = excluded.expires_at`
  )
    .bind(domain, scanData.trust_score, scanData.risk_level, flagsJson, metaJson, expiresAt)
    .run();

  const result: ScanResult = { ...scanData, id, created_at: now };
  return json({ success: true, data: result }, 200, origin);
}

export async function handleScanHistory(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "20", 10));
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const rows = await env.DB.prepare(
    `SELECT id, url, domain, trust_score, risk_level, flags, metadata, cached, created_at
     FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(userId, limit, offset)
    .all();

  const scans = rows.results.map((r) => ({
    ...r,
    flags: JSON.parse(r["flags"] as string),
    metadata: JSON.parse(r["metadata"] as string),
  }));

  return json({ success: true, data: scans }, 200, origin);
}
