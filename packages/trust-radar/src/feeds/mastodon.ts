/**
 * Mastodon/Fediverse Social Feed — Brand mention monitoring across instances.
 *
 * No authentication needed for public data.
 * Rate limit: 300 requests/5 minutes per instance.
 * Schedule: Every 4 hours
 *
 * Searches multiple Mastodon instances (including infosec.exchange)
 * for brand mentions, vulnerability disclosures, and threat discussions.
 * Rotates 10 brands per run.
 */

import type { FeedModule, FeedContext, FeedResult } from "./types";
import type { Env } from "../types";

// ─── Types ───────────────────────────────────────────────────────

interface BrandRow {
  id: string;
  name: string;
  canonical_domain: string | null;
}

interface MastodonStatus {
  id: string;
  url: string;
  content: string;       // HTML
  created_at: string;
  favourites_count: number;
  reblogs_count: number;
  in_reply_to_id: string | null;
  account: {
    acct: string;        // user@instance or just user
    url: string;
    display_name: string;
    followers_count: number;
  };
}

interface MastodonSearchResult {
  statuses: MastodonStatus[];
}

// Mastodon instances to search
const MASTODON_INSTANCES = [
  'mastodon.social',      // Largest general instance
  'infosec.exchange',     // InfoSec community (most relevant)
  'ioc.exchange',         // IOC sharing community
  'hachyderm.io',         // Tech community
];

const BRANDS_PER_RUN = 10;
const DELAY_BETWEEN_CALLS_MS = 1500;
const MAX_API_CALLS_PER_RUN = 80;

// ─── Feed Module ─────────────────────────────────────────────────

export const mastodon: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    const env = ctx.env;
    let itemsFetched = 0;
    let itemsNew = 0;
    let itemsDuplicate = 0;
    let itemsError = 0;
    let apiCalls = 0;

    // Get brands to monitor (rotate 10 per run)
    const offset = parseInt(await env.CACHE.get('mastodon_brand_offset') ?? '0', 10);
    const brands = await env.DB.prepare(`
      SELECT b.id, b.name, b.canonical_domain
      FROM brands b
      WHERE b.monitoring_status = 'active'
        AND b.threat_count > 0
      ORDER BY b.threat_count DESC
      LIMIT ? OFFSET ?
    `).bind(BRANDS_PER_RUN, offset).all<BrandRow>();

    // Update offset for next run
    const nextOffset = brands.results.length < BRANDS_PER_RUN ? 0 : offset + BRANDS_PER_RUN;
    await env.CACHE.put('mastodon_brand_offset', String(nextOffset), { expirationTtl: 86400 });

    // Load all brands for timeline scanning
    const allBrands = await env.DB.prepare(`
      SELECT id, name, canonical_domain FROM brands
      WHERE monitoring_status = 'active' AND threat_count > 0
      ORDER BY threat_count DESC LIMIT 50
    `).all<BrandRow>();

    // 1. Brand-specific search across instances
    for (const brand of brands.results) {
      for (const instance of MASTODON_INSTANCES) {
        if (apiCalls >= MAX_API_CALLS_PER_RUN) break;

        // Search for brand name
        try {
          const statuses = await searchMastodon(instance, brand.name);
          apiCalls++;
          const result = await processStatuses(env, statuses, brand, instance, 'keyword');
          itemsFetched += result.fetched;
          itemsNew += result.new;
          itemsDuplicate += result.duplicate;
        } catch (err) {
          itemsError++;
          console.error(`[mastodon] Search error for ${brand.name} on ${instance}:`, err instanceof Error ? err.message : String(err));
        }

        await delay(DELAY_BETWEEN_CALLS_MS);

        // Search for brand domain if available
        if (brand.canonical_domain && apiCalls < MAX_API_CALLS_PER_RUN) {
          try {
            const statuses = await searchMastodon(instance, brand.canonical_domain);
            apiCalls++;
            const result = await processStatuses(env, statuses, brand, instance, 'domain');
            itemsFetched += result.fetched;
            itemsNew += result.new;
            itemsDuplicate += result.duplicate;
          } catch (err) {
            itemsError++;
            console.error(`[mastodon] Domain search error for ${brand.canonical_domain} on ${instance}:`, err instanceof Error ? err.message : String(err));
          }

          await delay(DELAY_BETWEEN_CALLS_MS);
        }
      }
    }

    // 2. infosec.exchange local timeline scan — security researchers post here
    if (apiCalls < MAX_API_CALLS_PER_RUN) {
      try {
        const timelineStatuses = await fetchLocalTimeline('infosec.exchange');
        apiCalls++;

        for (const status of timelineStatuses) {
          const text = stripHtml(status.content).toLowerCase();

          for (const brand of allBrands.results) {
            const nameMatch = text.includes(brand.name.toLowerCase());
            const domainMatch = brand.canonical_domain
              ? text.includes(brand.canonical_domain.toLowerCase())
              : false;

            if (nameMatch || domainMatch) {
              const result = await insertMention(env, status, brand, 'infosec.exchange', domainMatch ? 'domain' : 'keyword');
              if (result === 'new') itemsNew++;
              else if (result === 'duplicate') itemsDuplicate++;
              itemsFetched++;
            }
          }
        }
      } catch (err) {
        itemsError++;
        console.error('[mastodon] infosec.exchange timeline error:', err instanceof Error ? err.message : String(err));
      }

      await delay(DELAY_BETWEEN_CALLS_MS);
    }

    // 3. ioc.exchange local timeline scan — IOC sharing community
    if (apiCalls < MAX_API_CALLS_PER_RUN) {
      try {
        const timelineStatuses = await fetchLocalTimeline('ioc.exchange');
        apiCalls++;

        for (const status of timelineStatuses) {
          const text = stripHtml(status.content).toLowerCase();

          for (const brand of allBrands.results) {
            const nameMatch = text.includes(brand.name.toLowerCase());
            const domainMatch = brand.canonical_domain
              ? text.includes(brand.canonical_domain.toLowerCase())
              : false;

            if (nameMatch || domainMatch) {
              const result = await insertMention(env, status, brand, 'ioc.exchange', domainMatch ? 'domain' : 'keyword');
              if (result === 'new') itemsNew++;
              else if (result === 'duplicate') itemsDuplicate++;
              itemsFetched++;
            }
          }
        }
      } catch (err) {
        itemsError++;
        console.error('[mastodon] ioc.exchange timeline error:', err instanceof Error ? err.message : String(err));
      }
    }

    console.log(`[mastodon] Complete: fetched=${itemsFetched} new=${itemsNew} dup=${itemsDuplicate} errors=${itemsError} api_calls=${apiCalls}`);
    return { itemsFetched, itemsNew, itemsDuplicate, itemsError };
  },
};

// ─── Mastodon API Calls ─────────────────────────────────────────

async function searchMastodon(instance: string, query: string): Promise<MastodonStatus[]> {
  const url = `https://${instance}/api/v2/search?q=${encodeURIComponent(query)}&type=statuses&limit=20`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Averrow/1.0 (Threat Intelligence Platform)' },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Mastodon search ${instance} ${response.status}`);
  }

  const data = await response.json() as MastodonSearchResult;
  return data.statuses ?? [];
}

async function fetchLocalTimeline(instance: string): Promise<MastodonStatus[]> {
  const url = `https://${instance}/api/v1/timelines/public?local=true&limit=40`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Averrow/1.0 (Threat Intelligence Platform)' },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Mastodon timeline ${instance} ${response.status}`);
  }

  return await response.json() as MastodonStatus[];
}

// ─── Result Processing ──────────────────────────────────────────

async function processStatuses(
  env: Env,
  statuses: MastodonStatus[],
  brand: BrandRow,
  instance: string,
  matchType: string,
): Promise<{ fetched: number; new: number; duplicate: number }> {
  let fetched = 0;
  let newCount = 0;
  let duplicate = 0;

  for (const status of statuses) {
    fetched++;
    const result = await insertMention(env, status, brand, instance, matchType);
    if (result === 'new') newCount++;
    else if (result === 'duplicate') duplicate++;
  }

  return { fetched, new: newCount, duplicate };
}

async function insertMention(
  env: Env,
  status: MastodonStatus,
  brand: BrandRow,
  instance: string,
  matchType: string,
): Promise<'new' | 'duplicate' | 'error'> {
  const dedupKey = `social:mastodon:${status.id}:${brand.id}`;

  // KV dedup
  const seen = await env.CACHE.get(dedupKey);
  if (seen) return 'duplicate';

  const mentionId = `mastodon_${instance}_${status.id}_${brand.id}`;

  // DB dedup
  const existing = await env.DB.prepare(
    `SELECT id FROM social_mentions WHERE id = ?`
  ).bind(mentionId).first();
  if (existing) {
    await env.CACHE.put(dedupKey, '1', { expirationTtl: 14400 });
    return 'duplicate';
  }

  const contentText = stripHtml(status.content).slice(0, 2000);
  const confidence = matchType === 'domain' ? 80 : 60;

  try {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO social_mentions
        (id, platform, source_feed, content_type, content_url, content_text,
         content_author, content_author_url, content_created,
         brand_id, brand_name, match_type, match_confidence,
         platform_metadata, status, created_at, updated_at)
      VALUES (?, 'mastodon', 'mastodon', 'toot', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now'), datetime('now'))
    `).bind(
      mentionId,
      status.url,
      contentText,
      status.account.acct,
      status.account.url,
      status.created_at,
      brand.id,
      brand.name,
      matchType,
      confidence,
      JSON.stringify({
        instance,
        favourites: status.favourites_count,
        reblogs: status.reblogs_count,
        in_reply_to: status.in_reply_to_id,
        account_followers: status.account.followers_count,
      }),
    ).run();

    await env.CACHE.put(dedupKey, '1', { expirationTtl: 14400 });
    return 'new';
  } catch (err) {
    console.error(`[mastodon] Insert error for ${mentionId}:`, err instanceof Error ? err.message : String(err));
    return 'error';
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
