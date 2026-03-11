/**
 * feedCatalog.ts — Master catalog of all supported data feed platforms.
 * Tiered: free → low_cost ($) → paid ($$+)
 * Each entry describes auth fields, configurable settings, pull constraints,
 * and costs so the AddFeedModal can render a dynamic configuration form.
 */

export type FeedTier = "free" | "low_cost" | "paid";

export interface AuthField {
  key: "api_key" | "api_secret";
  label: string;
  type: "text" | "password";
  required: boolean;
  placeholder?: string;
  help?: string;
}

export type SettingsFieldType = "text" | "textarea" | "number" | "boolean" | "select";

export interface SettingsField {
  key: string;
  label: string;
  type: SettingsFieldType;
  required: boolean;
  default?: string | number | boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
}

export interface FeedType {
  platform: string;
  displayName: string;
  tier: FeedTier;
  tierCost: string;
  icon: string;
  description: string;
  authFields: AuthField[];
  settingsFields: SettingsField[];
  defaultIntervalMins: number;
  minIntervalMins: number;
  docsUrl: string;
  quotaInfo: string;
  implemented: boolean; // true = live API calls; false = configured but pull stubbed
}

// ─── Shared auth fields ──────────────────────────────────────────────────────

/** Optional API key auth field for feeds that work without a key but support one. */
const OPTIONAL_API_KEY: AuthField = {
  key: "api_key",
  label: "API Key (optional)",
  type: "password",
  required: false,
  placeholder: "your-api-key",
  help: "Optional. Some providers offer higher rate limits or additional data with an API key.",
};

// ─── Shared settings fields used across multiple platforms ────────────────────

const SEARCH_QUERIES_FIELD: SettingsField = {
  key: "search_queries",
  label: "Search Queries",
  type: "textarea",
  required: false,
  placeholder: "kylerez\nkyle_rez\nkylerezofficial",
  help: "One handle or keyword per line. Defaults to all monitored influencer handles if empty.",
};

// ─────────────────────────────────────────────────────────────────────────────
// FREE TIER
// ─────────────────────────────────────────────────────────────────────────────

const FREE_FEEDS: FeedType[] = [
  {
    platform: "youtube",
    displayName: "YouTube",
    tier: "free",
    tierCost: "Free",
    icon: "▶",
    description: "Search YouTube channels for lookalike names using the Data API v3. 10,000 units/day free quota.",
    authFields: [
      { key: "api_key", label: "API Key", type: "password", required: true,
        placeholder: "AIzaSy...", help: "Create a key at console.cloud.google.com → APIs & Services → Credentials." },
    ],
    settingsFields: [
      SEARCH_QUERIES_FIELD,
      { key: "region_code", label: "Region Code", type: "text", required: false,
        placeholder: "US", default: "US", help: "ISO 3166-1 alpha-2 country code to bias results." },
    ],
    defaultIntervalMins: 60,
    minIntervalMins: 30,
    docsUrl: "https://developers.google.com/youtube/v3/docs/search/list",
    quotaInfo: "10,000 units/day · each search costs 100 units",
    implemented: true,
  },
  {
    platform: "twitch",
    displayName: "Twitch",
    tier: "free",
    tierCost: "Free",
    icon: "🟣",
    description: "Search Twitch streamers by handle via Helix API using OAuth client credentials.",
    authFields: [
      { key: "api_key",    label: "Client ID",     type: "password", required: true,  placeholder: "abc123...", help: "Found in dev.twitch.tv → Your Console → Application." },
      { key: "api_secret", label: "Client Secret", type: "password", required: true,  placeholder: "xyz789..." },
    ],
    settingsFields: [SEARCH_QUERIES_FIELD],
    defaultIntervalMins: 30,
    minIntervalMins: 15,
    docsUrl: "https://dev.twitch.tv/docs/api/reference/#search-channels",
    quotaInfo: "800 req/min with client credentials",
    implemented: true,
  },
  {
    platform: "reddit",
    displayName: "Reddit",
    tier: "free",
    tierCost: "Free",
    icon: "🔴",
    description: "Search Reddit usernames via the public JSON API. No credentials required.",
    authFields: [OPTIONAL_API_KEY],
    settingsFields: [SEARCH_QUERIES_FIELD],
    defaultIntervalMins: 60,
    minIntervalMins: 30,
    docsUrl: "https://www.reddit.com/dev/api/#GET_search",
    quotaInfo: "60 req/min unauthenticated",
    implemented: true,
  },
  {
    platform: "bluesky",
    displayName: "Bluesky",
    tier: "free",
    tierCost: "Free",
    icon: "🦋",
    description: "Search Bluesky actors via the public AT Protocol API. No credentials required.",
    authFields: [OPTIONAL_API_KEY],
    settingsFields: [SEARCH_QUERIES_FIELD],
    defaultIntervalMins: 30,
    minIntervalMins: 15,
    docsUrl: "https://docs.bsky.app/docs/api/app-bsky-actor-search-actors",
    quotaInfo: "Public endpoint; rate-limited per IP",
    implemented: true,
  },
  {
    platform: "tiktok",
    displayName: "TikTok",
    tier: "free",
    tierCost: "Free (approval req.)",
    icon: "🎵",
    description: "Search TikTok accounts via the Research API. Requires application approval from TikTok.",
    authFields: [
      { key: "api_key",    label: "Client Key",    type: "password", required: true, placeholder: "aw..." },
      { key: "api_secret", label: "Client Secret", type: "password", required: true, placeholder: "..." },
    ],
    settingsFields: [SEARCH_QUERIES_FIELD],
    defaultIntervalMins: 120,
    minIntervalMins: 60,
    docsUrl: "https://developers.tiktok.com/doc/research-api-overview/",
    quotaInfo: "Varies by approval level",
    implemented: false,
  },
  {
    platform: "mastodon",
    displayName: "Mastodon",
    tier: "free",
    tierCost: "Free",
    icon: "🐘",
    description: "Search accounts across Mastodon instances via the public v2 search API. No credentials required.",
    authFields: [
      { key: "api_key", label: "Access Token (optional)", type: "password", required: false,
        help: "Optional. Allows higher rate limits on your home instance." },
    ],
    settingsFields: [
      SEARCH_QUERIES_FIELD,
      { key: "instance", label: "Instance hostname", type: "text", required: false,
        placeholder: "mastodon.social", default: "mastodon.social",
        help: "Hostname only (no https://). Defaults to mastodon.social." },
    ],
    defaultIntervalMins: 60,
    minIntervalMins: 30,
    docsUrl: "https://docs.joinmastodon.org/methods/accounts/#search",
    quotaInfo: "300 req/5 min unauthenticated",
    implemented: true,
  },
  {
    platform: "github",
    displayName: "GitHub",
    tier: "free",
    tierCost: "Free",
    icon: "⌥",
    description: "Search GitHub users for lookalike handles using the public Search API. No credentials needed for 60 req/hr; add a token for 5,000 req/hr.",
    authFields: [
      { key: "api_key", label: "Personal Access Token (optional)", type: "password", required: false,
        placeholder: "ghp_...", help: "Optional. Increases rate limit from 60 to 5,000 req/hr. Settings → Developer settings → Personal access tokens." },
    ],
    settingsFields: [SEARCH_QUERIES_FIELD],
    defaultIntervalMins: 120,
    minIntervalMins: 60,
    docsUrl: "https://docs.github.com/en/rest/search/search#search-users",
    quotaInfo: "60 req/hr unauthenticated · 5,000 req/hr with token",
    implemented: true,
  },
  {
    platform: "rss",
    displayName: "RSS / Atom",
    tier: "free",
    tierCost: "Free",
    icon: "📡",
    description: "Monitor RSS or Atom feeds for handle mentions. Useful for news sites, platform status feeds, and aggregators.",
    authFields: [OPTIONAL_API_KEY],
    settingsFields: [
      { key: "feed_urls", label: "Feed URLs", type: "textarea", required: true,
        placeholder: "https://example.com/feed.xml\nhttps://other.com/rss",
        help: "One URL per line. Scans each item title and description for monitored influencer handles." },
    ],
    defaultIntervalMins: 60,
    minIntervalMins: 15,
    docsUrl: "https://www.rssboard.org/rss-specification",
    quotaInfo: "Unlimited (standard HTTP polling)",
    implemented: true,
  },
  {
    platform: "facebook",
    displayName: "Facebook",
    tier: "free",
    tierCost: "Free (app review req.)",
    icon: "📘",
    description: "Search public Facebook pages and profiles via Graph API. Requires Meta app review for most features.",
    authFields: [
      { key: "api_key", label: "Access Token", type: "password", required: true,
        placeholder: "EAAx...", help: "Generate a long-lived token at developers.facebook.com." },
    ],
    settingsFields: [SEARCH_QUERIES_FIELD],
    defaultIntervalMins: 60,
    minIntervalMins: 30,
    docsUrl: "https://developers.facebook.com/docs/graph-api/",
    quotaInfo: "200 calls/hour per user token",
    implemented: false,
  },
  {
    platform: "pinterest",
    displayName: "Pinterest",
    tier: "free",
    tierCost: "Free",
    icon: "📌",
    description: "Search Pinterest profiles and boards for lookalike accounts using the v5 API.",
    authFields: [
      { key: "api_key", label: "Access Token", type: "password", required: true,
        placeholder: "pina_...", help: "Create an app at developers.pinterest.com." },
    ],
    settingsFields: [SEARCH_QUERIES_FIELD],
    defaultIntervalMins: 120,
    minIntervalMins: 60,
    docsUrl: "https://developers.pinterest.com/docs/api/v5/",
    quotaInfo: "1,000 req/day on standard access",
    implemented: false,
  },
  {
    platform: "threads",
    displayName: "Threads",
    tier: "free",
    tierCost: "Free",
    icon: "🧵",
    description: "Monitor Threads (Meta) via the official API. Requires a connected Instagram Professional account.",
    authFields: [
      { key: "api_key", label: "Access Token", type: "password", required: true,
        placeholder: "THR...", help: "Obtain via Meta for Developers → Threads product." },
    ],
    settingsFields: [SEARCH_QUERIES_FIELD],
    defaultIntervalMins: 60,
    minIntervalMins: 30,
    docsUrl: "https://developers.facebook.com/docs/threads/",
    quotaInfo: "250 req/hour",
    implemented: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// LOW-COST TIER ($)
// ─────────────────────────────────────────────────────────────────────────────

const LOW_COST_FEEDS: FeedType[] = [
  {
    platform: "x_basic",
    displayName: "X / Twitter (Basic)",
    tier: "low_cost",
    tierCost: "$100 / mo",
    icon: "𝕏",
    description: "Search X/Twitter users and tweets using the v2 API Basic tier. 10,000 posts/month read access.",
    authFields: [
      { key: "api_key", label: "Bearer Token", type: "password", required: true,
        placeholder: "AAAA...", help: "Found in developer.twitter.com → Keys and Tokens." },
    ],
    settingsFields: [
      SEARCH_QUERIES_FIELD,
      { key: "usernames", label: "Exact Usernames to Check", type: "textarea", required: false,
        placeholder: "kylerez_official\nkyle.rez.fake",
        help: "One username per line. These are looked up directly (not search). Max 100." },
    ],
    defaultIntervalMins: 15,
    minIntervalMins: 10,
    docsUrl: "https://developer.x.com/en/docs/x-api",
    quotaInfo: "10,000 posts read / month",
    implemented: true,
  },
  {
    platform: "instagram_graph",
    displayName: "Instagram Graph API",
    tier: "low_cost",
    tierCost: "Business account req.",
    icon: "📸",
    description: "Monitor Instagram hashtags and business accounts via the Graph API. Requires Meta Business Suite.",
    authFields: [
      { key: "api_key",    label: "Access Token",              type: "password", required: true,  placeholder: "EAAx..." },
      { key: "api_secret", label: "Instagram Business Acct ID", type: "text",     required: true,  placeholder: "17841..." },
    ],
    settingsFields: [
      SEARCH_QUERIES_FIELD,
      { key: "hashtags", label: "Hashtags to Monitor", type: "textarea", required: false,
        placeholder: "kylerez\nkyle_rez_official", help: "Without # prefix. One per line." },
    ],
    defaultIntervalMins: 60,
    minIntervalMins: 30,
    docsUrl: "https://developers.facebook.com/docs/instagram-api/",
    quotaInfo: "200 calls/hour per token",
    implemented: false,
  },
  {
    platform: "apify",
    displayName: "Apify Scrapers",
    tier: "low_cost",
    tierCost: "$5 – $50 / mo",
    icon: "🕷",
    description: "Run ready-made social media scrapers (TikTok, Instagram, LinkedIn) via Apify actors.",
    authFields: [
      { key: "api_key", label: "API Token", type: "password", required: true,
        placeholder: "apify_api_...", help: "Found at console.apify.com → Settings → Integrations." },
    ],
    settingsFields: [
      { key: "actor_id", label: "Actor ID", type: "text", required: true,
        placeholder: "apify/tiktok-scraper", help: "e.g. apify/instagram-scraper or clockworks/tiktok-profile-scraper" },
      { key: "actor_input", label: "Actor Input JSON", type: "textarea", required: false,
        placeholder: '{"usernames":["kylerez"],"resultsLimit":50}',
        help: "Actor-specific input. Check the actor's README for the schema." },
    ],
    defaultIntervalMins: 120,
    minIntervalMins: 60,
    docsUrl: "https://docs.apify.com/api/v2",
    quotaInfo: "Pay-per-use compute units (~$0.25/1k results)",
    implemented: false,
  },
  {
    platform: "dataforseo",
    displayName: "DataForSEO",
    tier: "low_cost",
    tierCost: "$50+ / mo",
    icon: "📊",
    description: "Retrieve social media profile data and SERP results for brand monitoring via DataForSEO API.",
    authFields: [
      { key: "api_key",    label: "Login (email)", type: "text",     required: true },
      { key: "api_secret", label: "Password",      type: "password", required: true },
    ],
    settingsFields: [
      SEARCH_QUERIES_FIELD,
      { key: "location_code", label: "Location Code", type: "number", required: false,
        default: 2840, help: "2840 = United States. See DataForSEO location codes." },
    ],
    defaultIntervalMins: 60,
    minIntervalMins: 30,
    docsUrl: "https://docs.dataforseo.com/",
    quotaInfo: "Pay-per-task; ~$0.002–$0.01 per request",
    implemented: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PAID TIER ($$+)
// ─────────────────────────────────────────────────────────────────────────────

const PAID_FEEDS: FeedType[] = [
  {
    platform: "x_pro",
    displayName: "X / Twitter (Pro)",
    tier: "paid",
    tierCost: "$5,000 / mo",
    icon: "𝕏",
    description: "Full-firehose search and filtered stream access via X API Pro. Near real-time monitoring.",
    authFields: [
      { key: "api_key", label: "Bearer Token", type: "password", required: true, placeholder: "AAAA..." },
    ],
    settingsFields: [
      SEARCH_QUERIES_FIELD,
      { key: "usernames", label: "Exact Usernames to Check", type: "textarea", required: false,
        placeholder: "kylerez_official" },
      { key: "stream_rules", label: "Filtered Stream Rules", type: "textarea", required: false,
        placeholder: 'from:kylerez OR "kyle rez" -is:retweet',
        help: "Advanced PowerTrack rules for real-time stream filtering." },
    ],
    defaultIntervalMins: 5,
    minIntervalMins: 5,
    docsUrl: "https://developer.x.com/en/products/twitter-api/pro",
    quotaInfo: "1M tweets/month read + filtered stream",
    implemented: true, // shares runX() with x_basic
  },
  {
    platform: "brandwatch",
    displayName: "Brandwatch",
    tier: "paid",
    tierCost: "Enterprise",
    icon: "🔭",
    description: "Pull mention data from Brandwatch Consumer Intelligence saved searches into the threat pipeline.",
    authFields: [
      { key: "api_key", label: "API Token", type: "password", required: true, placeholder: "bw_..." },
    ],
    settingsFields: [
      { key: "project_id",  label: "Project ID",  type: "text", required: true },
      { key: "query_ids",   label: "Query IDs",   type: "textarea", required: true,
        placeholder: "123456\n789012", help: "One Brandwatch query ID per line." },
    ],
    defaultIntervalMins: 30,
    minIntervalMins: 15,
    docsUrl: "https://developers.brandwatch.com/",
    quotaInfo: "Varies by contract",
    implemented: false,
  },
  {
    platform: "meltwater",
    displayName: "Meltwater",
    tier: "paid",
    tierCost: "Enterprise",
    icon: "🧊",
    description: "Ingest social media mentions and news coverage from Meltwater saved search exports.",
    authFields: [
      { key: "api_key", label: "API Key", type: "password", required: true },
    ],
    settingsFields: [
      { key: "search_ids", label: "Saved Search IDs", type: "textarea", required: true,
        placeholder: "search_abc\nsearch_xyz", help: "One Meltwater saved search ID per line." },
    ],
    defaultIntervalMins: 30,
    minIntervalMins: 15,
    docsUrl: "https://developer.meltwater.com/",
    quotaInfo: "Varies by contract",
    implemented: false,
  },
  {
    platform: "proxycurl",
    displayName: "Proxycurl (LinkedIn)",
    tier: "paid",
    tierCost: "$49+ / mo",
    icon: "💼",
    description: "Enrich LinkedIn profile data to detect impersonators on professional networks via Proxycurl.",
    authFields: [
      { key: "api_key", label: "API Key", type: "password", required: true,
        placeholder: "pk_...", help: "Found at nubela.co → Dashboard → API Keys." },
    ],
    settingsFields: [
      { key: "profile_urls", label: "LinkedIn Profile URLs", type: "textarea", required: false,
        placeholder: "https://www.linkedin.com/in/kylerez\nhttps://www.linkedin.com/in/kyle-rez-fake",
        help: "One URL per line. Lookups cost credits — use sparingly." },
      { key: "search_queries", label: "Name Search Terms", type: "textarea", required: false,
        placeholder: "Kyle Rez\nKyleRez", help: "One search term per line." },
    ],
    defaultIntervalMins: 1440,
    minIntervalMins: 720,
    docsUrl: "https://nubela.co/proxycurl/docs",
    quotaInfo: "$0.01–$0.10 per profile lookup",
    implemented: false,
  },
  {
    platform: "mention",
    displayName: "Mention.com",
    tier: "paid",
    tierCost: "$41+ / mo",
    icon: "🔔",
    description: "Pull real-time brand mention alerts from Mention.com saved alert configurations.",
    authFields: [
      { key: "api_key", label: "Access Token", type: "password", required: true,
        placeholder: "Bearer ...", help: "Settings → API in your Mention account." },
    ],
    settingsFields: [
      { key: "alert_ids", label: "Alert IDs", type: "textarea", required: true,
        placeholder: "abcdef123\nxyz987",
        help: "One Mention alert ID per line. Found in the Mention alert URL." },
    ],
    defaultIntervalMins: 30,
    minIntervalMins: 15,
    docsUrl: "https://dev.mention.com/",
    quotaInfo: "Varies by plan",
    implemented: false,
  },
];

// ─── Flat catalog map ─────────────────────────────────────────────────────────
export const FEED_CATALOG: FeedType[] = [...FREE_FEEDS, ...LOW_COST_FEEDS, ...PAID_FEEDS];

export const FEED_CATALOG_MAP: Record<string, FeedType> = Object.fromEntries(
  FEED_CATALOG.map((f) => [f.platform, f])
);

export const TIER_GROUPS: Record<FeedTier, FeedType[]> = {
  free:     FREE_FEEDS,
  low_cost: LOW_COST_FEEDS,
  paid:     PAID_FEEDS,
};

export const TIER_LABELS: Record<FeedTier, string> = {
  free:     "Free",
  low_cost: "Low-Cost ($)",
  paid:     "Paid ($$+)",
};
