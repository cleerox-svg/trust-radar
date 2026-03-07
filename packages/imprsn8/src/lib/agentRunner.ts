/**
 * agentRunner.ts — Real implementations for all seven imprsn8 AI agents.
 *
 * Agents are triggered either manually (POST /api/agents/:id/trigger) or on
 * schedule via Cloudflare Cron. Each agent writes back to the DB so its
 * findings are immediately visible in the dashboard.
 *
 * SENTINEL  — Doppelganger Hunter: scans free platforms for handle typosquats
 * RECON     — Cross-Platform Discovery: finds influencer presences not yet monitored
 * VERITAS   — Deepfake Sentinel: content-level similarity analysis
 * NEXUS     — Scam Link Detector: URL reputation analysis on suspect accounts
 * ARBITER   — Risk Scorer: recalculates monitored_account risk from threat data + drift
 * WATCHDOG  — Profile Snapshot: captures account state baseline for drift detection
 * PHANTOM   — Voice Clone Detector (disabled, future)
 */

import type { Env } from "../types";

export interface AgentResult {
  items_scanned: number;
  threats_found: number;
  changes_detected: number;
  error?: string;
}

// ─── Levenshtein distance (duplicated here to keep agentRunner self-contained) ─
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? (prev[j - 1] ?? 0)
        : 1 + Math.min(prev[j] ?? i, curr[j - 1] ?? j, prev[j - 1] ?? 0);
    }
    prev = curr;
  }
  return prev[n] ?? 0;
}

function handleSimilarity(scraped: string, known: string): number {
  const s = scraped.toLowerCase().replace(/^@/, "");
  const h = known.toLowerCase();
  if (s === h) return 100; // exact match
  const dist = levenshtein(s, h);
  const maxLen = Math.max(s.length, h.length);
  if (maxLen === 0) return 100;
  return Math.max(0, Math.round(100 - (dist / maxLen) * 100));
}

// ─── Shared: load active influencer targets ──────────────────────────────────
interface Target {
  influencer_id: string;
  influencer_name: string;
  handles: string[];
}

async function loadTargets(env: Env, influencerId: string | null): Promise<Target[]> {
  const filter = influencerId ? "AND id = ?" : "";
  const profiles = await env.DB.prepare(
    `SELECT id, display_name, handle FROM influencer_profiles WHERE active = 1 ${filter}`
  ).bind(...(influencerId ? [influencerId] : [])).all<{ id: string; display_name: string; handle: string }>();

  const variants = await env.DB.prepare(
    `SELECT influencer_id, variant_handle FROM handle_variants WHERE is_active = 1`
  ).all<{ influencer_id: string; variant_handle: string }>();

  const variantMap: Record<string, string[]> = {};
  for (const v of variants.results) {
    (variantMap[v.influencer_id] ??= []).push(v.variant_handle.toLowerCase());
  }

  return profiles.results.map((p) => ({
    influencer_id: p.id,
    influencer_name: p.display_name,
    handles: [p.handle.toLowerCase(), ...(variantMap[p.id] ?? [])],
  }));
}

// ─── Shared: upsert an impersonation_report ──────────────────────────────────
async function upsertThreat(
  env: Env,
  influencer_id: string,
  platform: string,
  suspect_handle: string,
  suspect_url: string | null,
  suspect_followers: number | null,
  similarity_score: number,
  detected_by: string,
  ai_analysis: string,
  threat_type = "handle_squat",
): Promise<boolean> {
  const existing = await env.DB.prepare(
    `SELECT id FROM impersonation_reports
     WHERE influencer_id = ? AND platform = ? AND suspect_handle = ?
       AND status NOT IN ('resolved','dismissed')
     LIMIT 1`
  ).bind(influencer_id, platform, suspect_handle).first<{ id: string }>();
  if (existing) return false;

  const severity =
    similarity_score >= 85 ? "critical" :
    similarity_score >= 70 ? "high" :
    similarity_score >= 50 ? "medium" : "low";

  await env.DB.prepare(
    `INSERT INTO impersonation_reports
     (id, influencer_id, platform, suspect_handle, suspect_url, suspect_followers,
      threat_type, severity, similarity_score,
      similarity_breakdown, status, ai_analysis, detected_by, detected_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '{"bio_copy":0,"avatar_match":0,"posting_cadence":0,"handle_distance":0}',
             'new', ?, ?, datetime('now'), datetime('now'))`
  ).bind(
    crypto.randomUUID(), influencer_id, platform, suspect_handle,
    suspect_url, suspect_followers, threat_type, severity,
    similarity_score, ai_analysis, detected_by,
  ).run();
  return true;
}

// ─── WATCHDOG — Profile Snapshot ─────────────────────────────────────────────
// Captures current state of every monitored account into account_snapshots.
// If bio_hash or avatar_hash has changed since the last snapshot, flags the
// account for ARBITER to rescore and marks changes_detected.
async function runWatchdog(env: Env, influencerId: string | null): Promise<AgentResult> {
  const filter = influencerId ? "WHERE influencer_id = ?" : "WHERE 1=1";
  const accounts = await env.DB.prepare(
    `SELECT id, influencer_id, platform, handle, profile_url, follower_count,
            is_verified, bio_hash, avatar_hash
     FROM monitored_accounts ${filter} LIMIT 500`
  ).bind(...(influencerId ? [influencerId] : [])).all<{
    id: string; influencer_id: string; platform: string; handle: string;
    profile_url: string | null; follower_count: number | null;
    is_verified: number; bio_hash: string | null; avatar_hash: string | null;
  }>();

  let changes = 0;

  for (const acc of accounts.results) {
    // Fetch the most recent snapshot to compare against
    const last = await env.DB.prepare(
      `SELECT bio_hash, avatar_hash, follower_count FROM account_snapshots
       WHERE account_id = ? ORDER BY captured_at DESC LIMIT 1`
    ).bind(acc.id).first<{ bio_hash: string | null; avatar_hash: string | null; follower_count: number | null }>();

    // Detect drift (hash changes since last snapshot)
    const bioChanged    = last && last.bio_hash    && acc.bio_hash    && last.bio_hash    !== acc.bio_hash;
    const avatarChanged = last && last.avatar_hash && acc.avatar_hash && last.avatar_hash !== acc.avatar_hash;
    const followerSpike = last && last.follower_count !== null && acc.follower_count !== null
      && Math.abs((acc.follower_count - last.follower_count) / Math.max(last.follower_count, 1)) > 0.3;

    if (bioChanged || avatarChanged || followerSpike) {
      changes++;
      // Create a drift-event threat if significant bio or avatar change
      if (bioChanged || avatarChanged) {
        const driftType = bioChanged && avatarChanged ? "full_clone" : bioChanged ? "bio_copy" : "avatar_copy";
        await upsertThreat(
          env, acc.influencer_id, acc.platform, acc.handle, acc.profile_url,
          acc.follower_count, 75,
          "WATCHDOG",
          `WATCHDOG detected profile drift: ${bioChanged ? "bio hash changed" : ""}${avatarChanged ? " avatar hash changed" : ""}${followerSpike ? " follower spike >30%" : ""}.`,
          driftType,
        );
      }
    }

    // Always write a fresh snapshot record to capture the current known state
    await env.DB.prepare(
      `INSERT INTO account_snapshots
       (id, account_id, bio_hash, avatar_hash, follower_count, is_verified, captured_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      crypto.randomUUID(), acc.id,
      acc.bio_hash, acc.avatar_hash,
      acc.follower_count, acc.is_verified,
    ).run();

    // Update last_scanned_at
    await env.DB.prepare(
      `UPDATE monitored_accounts SET last_scanned_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
    ).bind(acc.id).run();
  }

  return { items_scanned: accounts.results.length, threats_found: 0, changes_detected: changes };
}

// ─── ARBITER — Risk Scorer ────────────────────────────────────────────────────
// Recomputes risk_score (0-100) and risk_category for every monitored account
// by weighting open threats and snapshot drift signals.
async function runArbiter(env: Env, influencerId: string | null): Promise<AgentResult> {
  const filter = influencerId ? "WHERE influencer_id = ?" : "WHERE 1=1";
  const accounts = await env.DB.prepare(
    `SELECT id, influencer_id FROM monitored_accounts ${filter} LIMIT 500`
  ).bind(...(influencerId ? [influencerId] : [])).all<{ id: string; influencer_id: string }>();

  let changes = 0;

  for (const acc of accounts.results) {
    // Count active threats against this influencer's account
    const threats = await env.DB.prepare(
      `SELECT severity, COUNT(*) as cnt
       FROM impersonation_reports
       WHERE influencer_id = ? AND status NOT IN ('resolved','dismissed')
       GROUP BY severity`
    ).bind(acc.influencer_id).all<{ severity: string; cnt: number }>();

    const severityMap: Record<string, number> = {};
    for (const t of threats.results) severityMap[t.severity] = t.cnt;

    // Score = weighted threat pressure (starts at 0 = no threats = legitimate)
    let score = 0;
    score += (severityMap["critical"] ?? 0) * 35;
    score += (severityMap["high"]     ?? 0) * 20;
    score += (severityMap["medium"]   ?? 0) * 10;
    score += (severityMap["low"]      ?? 0) * 5;

    // Drift bonus: count distinct bio/avatar hash values in last 7 days.
    // More than 1 distinct hash = the profile actually changed, which is suspicious.
    const driftData = await env.DB.prepare(
      `SELECT COUNT(DISTINCT bio_hash) as bio_changes, COUNT(DISTINCT avatar_hash) as avatar_changes
       FROM account_snapshots
       WHERE account_id = ? AND captured_at >= datetime('now', '-7 days')
         AND (bio_hash IS NOT NULL OR avatar_hash IS NOT NULL)`
    ).bind(acc.id).first<{ bio_changes: number; avatar_changes: number }>();
    const profileDrifted = (driftData?.bio_changes ?? 0) > 1 || (driftData?.avatar_changes ?? 0) > 1;
    if (profileDrifted) score += 15;

    score = Math.min(100, score);

    const category =
      score >= 50 ? "imposter" :
      score >= 10 ? "suspicious" : "legitimate";

    // Only write if changed
    const current = await env.DB.prepare(
      `SELECT risk_score, risk_category FROM monitored_accounts WHERE id = ?`
    ).bind(acc.id).first<{ risk_score: number; risk_category: string }>();

    if (current && (current.risk_score !== score || current.risk_category !== category)) {
      await env.DB.prepare(
        `UPDATE monitored_accounts
         SET risk_score = ?, risk_category = ?, last_scanned_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?`
      ).bind(score, category, acc.id).run();
      changes++;
    }
  }

  return { items_scanned: accounts.results.length, threats_found: 0, changes_detected: changes };
}

// ─── SENTINEL — Doppelganger Hunter ──────────────────────────────────────────
// Scans Bluesky (no auth) and Reddit (no auth) for handles similar to every
// active influencer. Creates impersonation_reports with detected_by='SENTINEL'.
async function runSentinel(env: Env, influencerId: string | null): Promise<AgentResult> {
  const targets = await loadTargets(env, influencerId);
  let scanned = 0;
  let found = 0;

  for (const target of targets) {
    const primaryHandle = target.handles[0];
    if (!primaryHandle) continue;

    // ── Bluesky public search ────────────────────────────────────────────────
    try {
      const url = `https://bsky.social/xrpc/app.bsky.actor.searchActors?term=${encodeURIComponent(primaryHandle)}&limit=25`;
      const res = await fetch(url, { headers: { "User-Agent": "imprsn8-sentinel/1.0" } });
      if (res.ok) {
        const data = await res.json() as { actors?: { handle: string; displayName?: string }[] };
        for (const actor of data.actors ?? []) {
          scanned++;
          const score = Math.max(
            handleSimilarity(actor.handle, primaryHandle),
            actor.displayName ? handleSimilarity(actor.displayName, primaryHandle) : 0,
          );
          if (score >= 50 && actor.handle.toLowerCase() !== primaryHandle) {
            const created = await upsertThreat(
              env, target.influencer_id, "bluesky", actor.handle,
              `https://bsky.app/profile/${actor.handle}`, null, score,
              "SENTINEL",
              `SENTINEL found handle "${actor.handle}" on Bluesky with ${score}% similarity to @${primaryHandle}. Display name: "${actor.displayName ?? ""}".`,
            );
            if (created) found++;
          }
        }
      }
    } catch { /* bluesky may be unavailable */ }

    // ── Reddit public search ─────────────────────────────────────────────────
    try {
      const url = `https://www.reddit.com/users/search.json?q=${encodeURIComponent(primaryHandle)}&limit=25`;
      const res = await fetch(url, { headers: { "User-Agent": "imprsn8-sentinel/1.0 (monitoring; admin@imprsn8.com)" } });
      if (res.ok) {
        const data = await res.json() as {
          data?: { children?: { data: { name: string; subreddit?: { subscribers?: number } } }[] }
        };
        for (const child of data.data?.children ?? []) {
          scanned++;
          const score = handleSimilarity(child.data.name, primaryHandle);
          if (score >= 50 && child.data.name.toLowerCase() !== primaryHandle) {
            const created = await upsertThreat(
              env, target.influencer_id, "reddit", child.data.name,
              `https://www.reddit.com/user/${child.data.name}`,
              child.data.subreddit?.subscribers ?? null, score,
              "SENTINEL",
              `SENTINEL found Reddit user "u/${child.data.name}" with ${score}% similarity to handle @${primaryHandle}.`,
            );
            if (created) found++;
          }
        }
      }
    } catch { /* reddit may be unavailable */ }

    // ── GitHub user search (free, no auth for basic) ─────────────────────────
    try {
      const url = `https://api.github.com/search/users?q=${encodeURIComponent(primaryHandle)}&per_page=20`;
      const res = await fetch(url, {
        headers: { "User-Agent": "imprsn8-sentinel/1.0", Accept: "application/vnd.github+json" },
      });
      if (res.ok) {
        const data = await res.json() as { items?: { login: string; html_url: string; followers?: number }[] };
        for (const u of data.items ?? []) {
          scanned++;
          const score = handleSimilarity(u.login, primaryHandle);
          if (score >= 50 && u.login.toLowerCase() !== primaryHandle) {
            const created = await upsertThreat(
              env, target.influencer_id, "github", u.login,
              u.html_url, u.followers ?? null, score,
              "SENTINEL",
              `SENTINEL found GitHub user "${u.login}" with ${score}% similarity to handle @${primaryHandle}.`,
            );
            if (created) found++;
          }
        }
      }
    } catch { /* github may rate-limit */ }

    // ── Mastodon public search ────────────────────────────────────────────────
    try {
      const url = `https://mastodon.social/api/v2/search?q=${encodeURIComponent(primaryHandle)}&type=accounts&limit=20&resolve=false`;
      const res = await fetch(url, { headers: { "User-Agent": "imprsn8-sentinel/1.0" } });
      if (res.ok) {
        const data = await res.json() as { accounts?: { username: string; display_name: string; url: string; followers_count?: number }[] };
        for (const acct of data.accounts ?? []) {
          scanned++;
          const score = Math.max(
            handleSimilarity(acct.username, primaryHandle),
            handleSimilarity(acct.display_name, primaryHandle),
          );
          if (score >= 50 && acct.username.toLowerCase() !== primaryHandle) {
            const created = await upsertThreat(
              env, target.influencer_id, "mastodon", acct.username,
              acct.url, acct.followers_count ?? null, score,
              "SENTINEL",
              `SENTINEL found Mastodon account "@${acct.username}" with ${score}% similarity to @${primaryHandle}. Display name: "${acct.display_name}".`,
            );
            if (created) found++;
          }
        }
      }
    } catch { /* mastodon may be rate-limited */ }
  }

  return { items_scanned: scanned, threats_found: found, changes_detected: 0 };
}

// ─── RECON — Cross-Platform Discovery ────────────────────────────────────────
// Identifies social platforms where an influencer's primary handle exists but
// is NOT yet in monitored_accounts. Creates a new monitored_account record so
// admins can review and officially track it.
async function runRecon(env: Env, influencerId: string | null): Promise<AgentResult> {
  const targets = await loadTargets(env, influencerId);
  let scanned = 0;
  let discovered = 0;

  const RECON_PLATFORMS: { platform: string; checkUrl: (h: string) => string; profileUrl: (h: string) => string }[] = [
    {
      platform: "bluesky",
      checkUrl: (h) => `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(h + ".bsky.social")}`,
      profileUrl: (h) => `https://bsky.app/profile/${h}.bsky.social`,
    },
    {
      platform: "reddit",
      checkUrl: (h) => `https://www.reddit.com/user/${encodeURIComponent(h)}/about.json`,
      profileUrl: (h) => `https://www.reddit.com/user/${h}`,
    },
    {
      platform: "github",
      checkUrl: (h) => `https://api.github.com/users/${encodeURIComponent(h)}`,
      profileUrl: (h) => `https://github.com/${h}`,
    },
    {
      platform: "mastodon",
      checkUrl: (h) => `https://mastodon.social/api/v1/accounts/lookup?acct=${encodeURIComponent(h)}`,
      profileUrl: (h) => `https://mastodon.social/@${h}`,
    },
  ];

  for (const target of targets) {
    const primaryHandle = target.handles[0];
    if (!primaryHandle) continue;

    // Get list of platforms already being monitored for this influencer
    const existing = await env.DB.prepare(
      `SELECT platform FROM monitored_accounts WHERE influencer_id = ?`
    ).bind(target.influencer_id).all<{ platform: string }>();
    const monitoredPlatforms = new Set(existing.results.map((r) => r.platform));

    for (const p of RECON_PLATFORMS) {
      scanned++;
      if (monitoredPlatforms.has(p.platform)) continue; // already tracked

      try {
        const headers: Record<string, string> = { "User-Agent": "imprsn8-recon/1.0" };
        if (p.platform === "github") headers["Accept"] = "application/vnd.github+json";
        if (p.platform === "reddit") headers["Accept"] = "application/json";

        const res = await fetch(p.checkUrl(primaryHandle), { headers });
        if (res.ok) {
          // Handle exists — create a monitored_account record
          const accountId = crypto.randomUUID();
          const now = new Date().toISOString();

          let followerCount: number | null = null;
          try {
            const json = await res.json() as Record<string, unknown>;
            if (p.platform === "reddit") {
              const data = (json.data as Record<string, unknown> | undefined);
              followerCount = (data?.total_karma as number | undefined) ?? null;
            } else if (p.platform === "github") {
              followerCount = (json.followers as number | undefined) ?? null;
            } else if (p.platform === "mastodon") {
              followerCount = (json.followers_count as number | undefined) ?? null;
            }
          } catch { /* ignore parse errors */ }

          // Insert as an unscored monitored account for admin review
          await env.DB.prepare(
            `INSERT OR IGNORE INTO monitored_accounts
             (id, influencer_id, platform, handle, profile_url, follower_count,
              risk_score, risk_category, added_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 100, 'unscored', ?, ?)`
          ).bind(
            accountId, target.influencer_id, p.platform, primaryHandle,
            p.profileUrl(primaryHandle), followerCount, now, now,
          ).run();

          // Initial snapshot
          await env.DB.prepare(
            `INSERT INTO account_snapshots (id, account_id, follower_count, captured_at)
             VALUES (?, ?, ?, ?)`
          ).bind(crypto.randomUUID(), accountId, followerCount, now).run();

          // Record discovery as a low-severity alert so SOC can review
          await upsertThreat(
            env, target.influencer_id, p.platform, primaryHandle,
            p.profileUrl(primaryHandle), followerCount, 30,
            "RECON",
            `RECON discovered @${primaryHandle} on ${p.platform} — this account was not previously monitored. Added for tracking. Please verify this is the authentic account.`,
            "other",
          );

          discovered++;
        }
      } catch { /* platform unreachable */ }
    }
  }

  return { items_scanned: scanned, threats_found: discovered, changes_detected: discovered };
}

// ─── NEXUS — Scam Link Detector ──────────────────────────────────────────────
// Reviews open impersonation_reports that have a suspect_url and evaluates it
// for scam patterns (suspicious TLDs, known phishing keywords, URL shorteners).
// Updates the ai_analysis field and escalates severity when malicious patterns found.
async function runNexus(env: Env, influencerId: string | null): Promise<AgentResult> {
  const filter = influencerId ? "AND influencer_id = ?" : "";
  const threats = await env.DB.prepare(
    `SELECT id, suspect_url, suspect_handle, platform, severity, influencer_id
     FROM impersonation_reports
     WHERE suspect_url IS NOT NULL
       AND status NOT IN ('resolved','dismissed') ${filter}
     LIMIT 200`
  ).bind(...(influencerId ? [influencerId] : [])).all<{
    id: string; suspect_url: string; suspect_handle: string; platform: string;
    severity: string; influencer_id: string;
  }>();

  // Signals that raise risk
  const SUSPICIOUS_TLDS = [".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top", ".click", ".link", ".online", ".site", ".pw"];
  const PHISHING_KEYWORDS = ["verify", "confirm", "login", "signin", "secure", "account", "wallet", "crypto", "giveaway", "free", "win", "prize", "airdrop"];
  const URL_SHORTENERS   = ["bit.ly", "tinyurl.com", "t.co", "ow.ly", "short.io", "rb.gy", "buff.ly", "dlvr.it"];

  let scanned = 0;
  let escalated = 0;

  for (const threat of threats.results) {
    scanned++;
    let suspicionScore = 0;
    const flags: string[] = [];

    try {
      const url = new URL(threat.suspect_url);
      const hostname = url.hostname.toLowerCase();
      const pathname = url.pathname.toLowerCase();

      // TLD check
      for (const tld of SUSPICIOUS_TLDS) {
        if (hostname.endsWith(tld)) { suspicionScore += 30; flags.push(`suspicious TLD: ${tld}`); break; }
      }

      // Phishing keywords in URL
      const urlStr = (hostname + pathname).toLowerCase();
      for (const kw of PHISHING_KEYWORDS) {
        if (urlStr.includes(kw)) { suspicionScore += 15; flags.push(`phishing keyword: ${kw}`); }
      }

      // URL shortener (hides destination)
      for (const s of URL_SHORTENERS) {
        if (hostname.includes(s)) { suspicionScore += 20; flags.push(`URL shortener: ${s}`); break; }
      }

      // IP address instead of domain
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        suspicionScore += 40; flags.push("IP address URL");
      }

      // Homoglyph / lookalike domain (contains known brand name with extra chars)
      if (/[0-9]/.test(hostname) && hostname.includes("-")) {
        suspicionScore += 10; flags.push("hyphenated domain with numbers");
      }

      // HTTP (not HTTPS) for a "login" page
      if (url.protocol === "http:" && flags.some((f) => f.includes("phishing"))) {
        suspicionScore += 20; flags.push("HTTP (not HTTPS) with phishing keywords");
      }
    } catch {
      // Invalid URL itself is suspicious
      suspicionScore += 20; flags.push("malformed URL");
    }

    if (suspicionScore > 0) {
      const analysis = `NEXUS URL analysis: suspicion score ${suspicionScore}/100. Flags: ${flags.join("; ")}.`;
      const newSeverity =
        suspicionScore >= 60 ? "critical" :
        suspicionScore >= 40 ? "high" :
        suspicionScore >= 20 ? "medium" : threat.severity;

      await env.DB.prepare(
        `UPDATE impersonation_reports
         SET ai_analysis = ?, severity = ?,
             status = CASE WHEN status = 'new' AND ? >= 40 THEN 'investigating' ELSE status END,
             updated_at = datetime('now')
         WHERE id = ?`
      ).bind(analysis, newSeverity, suspicionScore, threat.id).run();

      if (suspicionScore >= 40) escalated++;
    }
  }

  return { items_scanned: scanned, threats_found: escalated, changes_detected: escalated };
}

// ─── VERITAS — Deepfake Sentinel / Content Similarity ────────────────────────
// Analyses threats with high similarity_score for content-level clone signals.
// If LRX_API_URL + LRX_API_KEY are configured, delegates to external AI.
// Otherwise, performs heuristic analysis from stored account data.
async function runVeritas(env: Env, influencerId: string | null): Promise<AgentResult> {
  const filter = influencerId ? "AND ir.influencer_id = ?" : "";
  const threats = await env.DB.prepare(
    `SELECT ir.id, ir.similarity_score, ir.suspect_handle, ir.platform,
            ir.suspect_url, ir.influencer_id, ir.threat_type,
            ip.handle as real_handle, ip.display_name as influencer_name
     FROM impersonation_reports ir
     JOIN influencer_profiles ip ON ip.id = ir.influencer_id
     WHERE ir.status NOT IN ('resolved','dismissed')
       AND (ir.similarity_score IS NULL OR ir.similarity_score >= 60)
       AND ir.ai_analysis IS NULL ${filter}
     LIMIT 100`
  ).bind(...(influencerId ? [influencerId] : [])).all<{
    id: string; similarity_score: number | null; suspect_handle: string; platform: string;
    suspect_url: string | null; influencer_id: string; threat_type: string;
    real_handle: string; influencer_name: string;
  }>();

  let scanned = 0;
  let enriched = 0;

  for (const threat of threats.results) {
    scanned++;

    let analysis: string;

    // ── External AI analysis (LRX API) if configured ─────────────────────────
    if (env.LRX_API_URL && env.LRX_API_KEY) {
      try {
        const res = await fetch(`${env.LRX_API_URL}/v1/impersonation/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.LRX_API_KEY}`,
          },
          body: JSON.stringify({
            suspect_handle: threat.suspect_handle,
            suspect_url: threat.suspect_url,
            platform: threat.platform,
            target_handle: threat.real_handle,
            influencer_name: threat.influencer_name,
          }),
        });
        if (res.ok) {
          const data = await res.json() as { analysis?: string; confidence?: number };
          analysis = data.analysis ?? `LRX API confidence: ${data.confidence ?? "unknown"}%`;
          enriched++;
        } else {
          analysis = `VERITAS heuristic: handle "${threat.suspect_handle}" is ${threat.similarity_score ?? 0}% similar to @${threat.real_handle} on ${threat.platform}.`;
        }
      } catch {
        analysis = `VERITAS heuristic: handle "${threat.suspect_handle}" is ${threat.similarity_score ?? 0}% similar to @${threat.real_handle} on ${threat.platform}.`;
      }
    } else {
      // ── Heuristic analysis ────────────────────────────────────────────────
      const score = threat.similarity_score ?? 0;
      const signals: string[] = [];

      if (score >= 90) signals.push("near-identical handle (possible typosquat or character substitution)");
      if (score >= 80) signals.push("high handle similarity — likely intentional impersonation");
      if (["full_clone", "bio_copy"].includes(threat.threat_type)) signals.push("content clone pattern");
      if (threat.suspect_handle.includes(threat.real_handle)) signals.push("original handle embedded in impersonator handle");
      if (/official|real|true|the|verify|verified/.test(threat.suspect_handle.toLowerCase())) {
        signals.push("handle contains credibility keyword (official/real/verified)");
      }

      analysis = `VERITAS analysis: ${score}% similarity. Signals: ${signals.length > 0 ? signals.join("; ") : "no additional signals detected"}.`;
      enriched++;
    }

    await env.DB.prepare(
      `UPDATE impersonation_reports SET ai_analysis = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(analysis, threat.id).run();
  }

  return { items_scanned: scanned, threats_found: 0, changes_detected: enriched };
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────
export async function runAgent(
  agentName: string,
  env: Env,
  influencerId: string | null,
): Promise<AgentResult> {
  switch (agentName.toUpperCase()) {
    case "WATCHDOG": return await runWatchdog(env, influencerId);
    case "ARBITER":  return await runArbiter(env, influencerId);
    case "SENTINEL": return await runSentinel(env, influencerId);
    case "RECON":    return await runRecon(env, influencerId);
    case "NEXUS":    return await runNexus(env, influencerId);
    case "VERITAS":  return await runVeritas(env, influencerId);
    default:
      return { items_scanned: 0, threats_found: 0, changes_detected: 0, error: `Unknown agent: ${agentName}` };
  }
}

// ─── Post-feed hook: rescore accounts touched by a feed run ──────────────────
// Call this after any feed run to immediately update risk scores for influencers
// whose threats were created or modified.
export async function rescoreInfluencers(env: Env, influencerIds: string[]): Promise<void> {
  for (const id of influencerIds) {
    await runArbiter(env, id);
  }
}
