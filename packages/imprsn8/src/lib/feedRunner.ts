/**
 * feedRunner.ts — Platform-specific feed execution engine.
 *
 * Each `run*` function calls a social platform API, compares handles against
 * all monitored influencer profiles + their watchlisted handle variants, and
 * creates impersonation_reports for any close matches found.
 *
 * Fully implemented: YouTube, Twitch, Bluesky, Reddit, X (Basic/Pro)
 * Stubbed (config accepted, pull deferred): TikTok, Instagram, Facebook,
 *   Pinterest, Threads, Mastodon, RSS, Apify, DataForSEO,
 *   Brandwatch, Meltwater, Proxycurl, Mention
 */

import type { Env, DataFeed } from "../types";

// ─── Levenshtein distance ────────────────────────────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  // Two-row rolling DP to avoid 2-D array indexing issues
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

// ─── Target influencers loaded from DB ──────────────────────────────────────
interface Target {
  influencer_id: string;
  influencer_name: string;
  handles: string[]; // primary handle + all active variant handles
}

async function loadTargets(env: Env): Promise<Target[]> {
  const profiles = await env.DB.prepare(
    `SELECT id, display_name, handle FROM influencer_profiles WHERE active = 1`
  ).all<{ id: string; display_name: string; handle: string }>();

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

// ─── Match a scraped handle against known targets ────────────────────────────
interface Match {
  target: Target;
  similarity_score: number; // 0-100
  matched_handle: string;
}

function matchHandle(scraped: string, targets: Target[]): Match | null {
  const s = scraped.toLowerCase().replace(/^@/, "");
  let best: Match | null = null;

  for (const target of targets) {
    for (const h of target.handles) {
      // Exact match → skip (that's the real account)
      if (s === h) continue;
      // Contains match (e.g. scraped = "kylerez_official", target = "kylerez")
      const containsMatch = s.includes(h) || h.includes(s);
      const dist = levenshtein(s, h);
      const maxLen = Math.max(s.length, h.length);
      // Normalise: distance ≤ 3 chars OR ≤ 30% of handle length
      if (dist <= 3 || containsMatch || dist / maxLen <= 0.3) {
        const score = Math.max(10, Math.round(100 - (dist / maxLen) * 100));
        if (!best || score > best.similarity_score) {
          best = { target, similarity_score: score, matched_handle: h };
        }
      }
    }
  }
  return best;
}

// ─── Create or skip-if-duplicate impersonation_report ───────────────────────
async function upsertThreat(
  env: Env,
  influencer_id: string,
  platform: string,
  suspect_handle: string,
  suspect_url: string | null,
  suspect_followers: number | null,
  similarity_score: number,
  feed_name: string,
): Promise<boolean> {
  // Skip if we already have an open report for this handle+platform+influencer
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

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO impersonation_reports
     (id, influencer_id, platform, suspect_handle, suspect_url, suspect_followers,
      threat_type, severity, similarity_score, status, ai_analysis, detected_by, detected_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'handle_squat', ?, ?, 'new', ?, 'RECON', datetime('now'), datetime('now'))`
  ).bind(
    id, influencer_id, platform, suspect_handle, suspect_url, suspect_followers,
    severity, similarity_score,
    `Detected by feed: ${feed_name}. Handle similarity: ${similarity_score}%.`,
  ).run();
  return true;
}

// ─── Result shape returned by every platform runner ─────────────────────────
export interface RunResult {
  success: boolean;
  threats_found: number;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM IMPLEMENTATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** YouTube Data API v3 — search channels */
async function runYouTube(feed: DataFeed, env: Env, targets: Target[]): Promise<number> {
  if (!feed.api_key) throw new Error("YouTube requires an API key");
  const settings = JSON.parse(feed.settings_json) as { search_queries?: string[]; region_code?: string };
  const queries: string[] = settings.search_queries ?? targets.map((t) => t.handles[0]).filter((h): h is string => !!h);
  let found = 0;

  for (const q of queries.slice(0, 10)) {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("q", q);
    url.searchParams.set("type", "channel");
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", feed.api_key);
    if (settings.region_code) url.searchParams.set("regionCode", settings.region_code);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`YouTube API ${res.status}: ${await res.text()}`);
    const data = await res.json() as { items?: { snippet: { channelTitle: string; channelId: string } }[] };

    for (const item of data.items ?? []) {
      const handle = item.snippet.channelTitle;
      const match = matchHandle(handle, targets);
      if (match) {
        const profile_url = `https://www.youtube.com/channel/${item.snippet.channelId}`;
        const created = await upsertThreat(
          env, match.target.influencer_id, "youtube", handle, profile_url,
          null, match.similarity_score, feed.name,
        );
        if (created) found++;
      }
    }
  }
  return found;
}

/** Twitch Helix API — OAuth client-credentials + channel search */
async function runTwitch(feed: DataFeed, env: Env, targets: Target[]): Promise<number> {
  if (!feed.api_key || !feed.api_secret) throw new Error("Twitch requires Client-ID (api_key) and Client-Secret (api_secret)");
  const settings = JSON.parse(feed.settings_json) as { search_queries?: string[] };
  const queries: string[] = settings.search_queries ?? targets.map((t) => t.handles[0]).filter((h): h is string => !!h);

  // Get OAuth token
  const tokenRes = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(feed.api_key)}&client_secret=${encodeURIComponent(feed.api_secret)}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (!tokenRes.ok) throw new Error(`Twitch OAuth ${tokenRes.status}`);
  const { access_token } = await tokenRes.json() as { access_token: string };

  let found = 0;
  for (const q of queries.slice(0, 10)) {
    const url = `https://api.twitch.tv/helix/search/channels?query=${encodeURIComponent(q)}&live_only=false&first=20`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${access_token}`, "Client-Id": feed.api_key },
    });
    if (!res.ok) throw new Error(`Twitch search ${res.status}`);
    const data = await res.json() as { data?: { display_name: string; broadcaster_login: string }[] };

    for (const ch of data.data ?? []) {
      const match = matchHandle(ch.broadcaster_login, targets) ?? matchHandle(ch.display_name, targets);
      if (match) {
        const profile_url = `https://www.twitch.tv/${ch.broadcaster_login}`;
        const created = await upsertThreat(
          env, match.target.influencer_id, "twitch", ch.broadcaster_login,
          profile_url, null, match.similarity_score, feed.name,
        );
        if (created) found++;
      }
    }
  }
  return found;
}

/** Bluesky AT Protocol — public actor search, no auth required */
async function runBluesky(feed: DataFeed, env: Env, targets: Target[]): Promise<number> {
  const settings = JSON.parse(feed.settings_json) as { search_queries?: string[] };
  const queries: string[] = settings.search_queries ?? targets.map((t) => t.handles[0]).filter((h): h is string => !!h);
  let found = 0;

  for (const q of queries.slice(0, 10)) {
    const url = `https://bsky.social/xrpc/app.bsky.actor.searchActors?term=${encodeURIComponent(q)}&limit=25`;
    const res = await fetch(url, { headers: { "User-Agent": "imprsn8/1.0" } });
    if (!res.ok) continue; // Bluesky can 429 — skip gracefully
    const data = await res.json() as { actors?: { handle: string; displayName?: string; viewer?: unknown }[] };

    for (const actor of data.actors ?? []) {
      const match = matchHandle(actor.handle, targets) ?? matchHandle(actor.displayName ?? "", targets);
      if (match) {
        const profile_url = `https://bsky.app/profile/${actor.handle}`;
        const created = await upsertThreat(
          env, match.target.influencer_id, "bluesky", actor.handle,
          profile_url, null, match.similarity_score, feed.name,
        );
        if (created) found++;
      }
    }
  }
  return found;
}

/** Reddit public JSON API — user search (no auth needed for basic search) */
async function runReddit(feed: DataFeed, env: Env, targets: Target[]): Promise<number> {
  const settings = JSON.parse(feed.settings_json) as { search_queries?: string[] };
  const queries: string[] = settings.search_queries ?? targets.map((t) => t.handles[0]).filter((h): h is string => !!h);
  let found = 0;

  for (const q of queries.slice(0, 10)) {
    const url = `https://www.reddit.com/users/search.json?q=${encodeURIComponent(q)}&limit=25`;
    const res = await fetch(url, {
      headers: { "User-Agent": "imprsn8/1.0 (social monitoring; admin@imprsn8.com)" },
    });
    if (!res.ok) continue;
    const data = await res.json() as {
      data?: { children?: { data: { name: string; icon_img?: string; subreddit?: { subscribers?: number } } }[] }
    };

    for (const child of data.data?.children ?? []) {
      const username = child.data.name;
      const match = matchHandle(username, targets);
      if (match) {
        const profile_url = `https://www.reddit.com/user/${username}`;
        const followers = child.data.subreddit?.subscribers ?? null;
        const created = await upsertThreat(
          env, match.target.influencer_id, "reddit", username,
          profile_url, followers, match.similarity_score, feed.name,
        );
        if (created) found++;
      }
    }
  }
  return found;
}

/** X / Twitter API v2 — bearer token, user lookup + search */
async function runX(feed: DataFeed, env: Env, targets: Target[]): Promise<number> {
  if (!feed.api_key) throw new Error("X API requires a Bearer Token (api_key)");
  const settings = JSON.parse(feed.settings_json) as { search_queries?: string[]; usernames?: string[] };
  let found = 0;

  // Lookup specific usernames if configured
  const usernames: string[] = settings.usernames ?? [];
  if (usernames.length > 0) {
    const url = `https://api.twitter.com/2/users/by?usernames=${usernames.slice(0, 100).join(",")}&user.fields=public_metrics`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${feed.api_key}` } });
    if (res.ok) {
      const data = await res.json() as { data?: { username: string; name: string; public_metrics?: { followers_count: number } }[] };
      for (const u of data.data ?? []) {
        const match = matchHandle(u.username, targets) ?? matchHandle(u.name, targets);
        if (match) {
          const created = await upsertThreat(
            env, match.target.influencer_id, "x", u.username,
            `https://x.com/${u.username}`, u.public_metrics?.followers_count ?? null,
            match.similarity_score, feed.name,
          );
          if (created) found++;
        }
      }
    }
  }

  // Search recent tweets/profiles for each query
  for (const q of (settings.search_queries ?? []).slice(0, 5)) {
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(q)}&max_results=100&expansions=author_id&user.fields=username,name,public_metrics`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${feed.api_key}` } });
    if (!res.ok) continue;
    const data = await res.json() as { includes?: { users?: { username: string; name: string; public_metrics?: { followers_count: number } }[] } };
    for (const u of data.includes?.users ?? []) {
      const match = matchHandle(u.username, targets) ?? matchHandle(u.name, targets);
      if (match) {
        const created = await upsertThreat(
          env, match.target.influencer_id, "x", u.username,
          `https://x.com/${u.username}`, u.public_metrics?.followers_count ?? null,
          match.similarity_score, feed.name,
        );
        if (created) found++;
      }
    }
  }
  return found;
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────
export async function runFeed(feed: DataFeed, env: Env): Promise<RunResult> {
  const targets = await loadTargets(env);
  if (targets.length === 0) return { success: true, threats_found: 0 };

  try {
    let threats_found = 0;
    switch (feed.platform) {
      case "youtube":  threats_found = await runYouTube(feed, env, targets); break;
      case "twitch":   threats_found = await runTwitch(feed, env, targets);  break;
      case "bluesky":  threats_found = await runBluesky(feed, env, targets); break;
      case "reddit":   threats_found = await runReddit(feed, env, targets);  break;
      case "x_basic":
      case "x_pro":    threats_found = await runX(feed, env, targets);       break;
      default:
        // Platform configured but not yet implemented — recorded successfully.
        return { success: true, threats_found: 0 };
    }
    return { success: true, threats_found };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[feedRunner] ${feed.platform} feed "${feed.name}" failed:`, error);
    return { success: false, threats_found: 0, error };
  }
}

/** Called by the Cloudflare cron scheduled handler. */
export async function runDueFeeds(env: Env): Promise<void> {
  const due = await env.DB.prepare(
    `SELECT * FROM data_feeds
     WHERE is_active = 1
       AND (last_pulled_at IS NULL
            OR datetime(last_pulled_at, '+' || pull_interval_mins || ' minutes') <= datetime('now'))
     LIMIT 20`
  ).all<DataFeed>();

  for (const feed of due.results) {
    await env.DB.prepare(
      `UPDATE data_feeds SET last_pull_status = 'running', updated_at = datetime('now') WHERE id = ?`
    ).bind(feed.id).run();

    const result = await runFeed(feed, env);

    await env.DB.prepare(
      `UPDATE data_feeds
       SET last_pulled_at = datetime('now'),
           last_pull_status = ?,
           last_pull_error = ?,
           pull_count = pull_count + 1,
           threats_found = threats_found + ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).bind(
      result.success ? "success" : "error",
      result.error ?? null,
      result.threats_found,
      feed.id,
    ).run();
  }
}
