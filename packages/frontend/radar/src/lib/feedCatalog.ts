/**
 * feedCatalog.ts — Master catalog of all Trust Radar intelligence feed providers.
 * Tiered by ingestion priority (1-6).
 * Each entry describes auth fields, configurable settings, pull constraints,
 * and provider-specific configuration so the Add/Edit feed modals render dynamic forms.
 *
 * Mirrors the imprsn8 feedCatalog pattern for code sharing.
 */

export type FeedTier = 1 | 2 | 3 | 4 | 5 | 6;

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

export interface IntelFeedType {
  feedName: string;          // matches feed_schedules.feed_name
  displayName: string;
  tier: FeedTier;
  category: string;          // threat, vulnerability, reputation, social, infrastructure
  icon: string;
  description: string;
  providerUrl: string;       // link to provider docs / homepage
  authFields: AuthField[];
  settingsFields: SettingsField[];
  defaultIntervalMins: number;
  minIntervalMins: number;
  quotaInfo: string;
  parser: string;            // json, csv, xml, text, custom
  implemented: boolean;
}

// ─── Shared auth fields ─────────────────────────────────────────────────

/** Optional API key auth field for feeds that work without a key but support one. */
const OPTIONAL_API_KEY: AuthField = {
  key: "api_key",
  label: "API Key (optional)",
  type: "password",
  required: false,
  placeholder: "your-api-key",
  help: "Optional. Some providers offer higher rate limits or additional data with an API key.",
};

// ─── Shared settings fields ─────────────────────────────────────────────

const CONFIDENCE_THRESHOLD: SettingsField = {
  key: "min_confidence",
  label: "Minimum Confidence Score",
  type: "number",
  required: false,
  default: 50,
  placeholder: "50",
  help: "Only ingest IOCs with confidence >= this value (0-100).",
};

const MAX_RECORDS: SettingsField = {
  key: "max_records",
  label: "Max Records Per Pull",
  type: "number",
  required: false,
  default: 500,
  placeholder: "500",
  help: "Limit items fetched per pull cycle. Lower values reduce processing time.",
};

const SEVERITY_FILTER: SettingsField = {
  key: "severity_filter",
  label: "Severity Filter",
  type: "select",
  required: false,
  default: "all",
  options: [
    { value: "all", label: "All severities" },
    { value: "critical", label: "Critical only" },
    { value: "high", label: "High and above" },
    { value: "medium", label: "Medium and above" },
  ],
  help: "Only ingest threats at or above the selected severity level.",
};

const IOC_TYPES_FILTER: SettingsField = {
  key: "ioc_types",
  label: "IOC Type Filter",
  type: "textarea",
  required: false,
  placeholder: "domain\nip\nurl\nhash",
  help: "One IOC type per line. Leave empty for all types.",
};

// ─── Tier 1: Real-time Critical (5-15min) ─────────────────────────────

const TIER1_FEEDS: IntelFeedType[] = [
  {
    feedName: "threatfox",
    displayName: "ThreatFox (abuse.ch)",
    tier: 1,
    category: "threat",
    icon: "🦊",
    description: "Real-time IOCs from abuse.ch's ThreatFox platform. Covers malware, C2 servers, and botnet infrastructure.",
    providerUrl: "https://threatfox.abuse.ch/",
    authFields: [OPTIONAL_API_KEY],
    settingsFields: [
      IOC_TYPES_FILTER,
      CONFIDENCE_THRESHOLD,
      { key: "days_back", label: "Days to Look Back", type: "number", required: false, default: 1, help: "Number of days of historical data to fetch on each pull." },
    ],
    defaultIntervalMins: 15,
    minIntervalMins: 5,
    quotaInfo: "Public API, no rate limit published. Recommended: 15-30min intervals.",
    parser: "json",
    implemented: true,
  },
  {
    feedName: "feodo",
    displayName: "Feodo Tracker (abuse.ch)",
    tier: 1,
    category: "threat",
    icon: "🔴",
    description: "Tracks Dridex, Emotet, TrickBot, and QakBot C2 infrastructure. IP-based blocklist with high confidence.",
    providerUrl: "https://feodotracker.abuse.ch/",
    authFields: [OPTIONAL_API_KEY],
    settingsFields: [MAX_RECORDS],
    defaultIntervalMins: 15,
    minIntervalMins: 5,
    quotaInfo: "Public feed. Text-based blocklist, lightweight.",
    parser: "text",
    implemented: true,
  },
  {
    feedName: "phishtank",
    displayName: "PhishTank Community",
    tier: 1,
    category: "threat",
    icon: "🎣",
    description: "Community-verified phishing URLs. Large volume feed covering global phishing campaigns.",
    providerUrl: "https://phishtank.org/",
    authFields: [
      { key: "api_key", label: "API Key (optional)", type: "password", required: false, placeholder: "your-api-key", help: "Optional. Increases rate limits. Register at phishtank.org." },
    ],
    settingsFields: [MAX_RECORDS, CONFIDENCE_THRESHOLD],
    defaultIntervalMins: 30,
    minIntervalMins: 15,
    quotaInfo: "Unauthenticated: hourly limit. With key: higher throughput.",
    parser: "json",
    implemented: true,
  },
];

// ─── Tier 2: High Priority (15-60min) ─────────────────────────────────

const TIER2_FEEDS: IntelFeedType[] = [
  {
    feedName: "cisa_kev",
    displayName: "CISA KEV",
    tier: 2,
    category: "vulnerability",
    icon: "🏛️",
    description: "CISA Known Exploited Vulnerabilities catalog. CVE IDs with vendor, product, severity, and remediation deadlines.",
    providerUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    authFields: [OPTIONAL_API_KEY],
    settingsFields: [
      { key: "vendor_filter", label: "Vendor Filter", type: "textarea", required: false, placeholder: "Microsoft\nApple\nGoogle", help: "Only ingest KEVs from these vendors. One per line. Leave empty for all." },
      SEVERITY_FILTER,
    ],
    defaultIntervalMins: 360,
    minIntervalMins: 60,
    quotaInfo: "Public JSON feed. Updated ~daily. Low volume, high value.",
    parser: "json",
    implemented: true,
  },
  {
    feedName: "sslbl",
    displayName: "SSL Blocklist (abuse.ch)",
    tier: 2,
    category: "threat",
    icon: "🔒",
    description: "SSL certificates associated with malware and botnet C2 servers. IP-based blocklist.",
    providerUrl: "https://sslbl.abuse.ch/",
    authFields: [OPTIONAL_API_KEY],
    settingsFields: [MAX_RECORDS],
    defaultIntervalMins: 30,
    minIntervalMins: 15,
    quotaInfo: "Public CSV feed. Updated frequently.",
    parser: "csv",
    implemented: true,
  },
  {
    feedName: "malbazaar",
    displayName: "MalBazaar (abuse.ch)",
    tier: 2,
    category: "threat",
    icon: "🧬",
    description: "Malware sample repository. Tracks hashes, signatures, and delivery infrastructure for recent malware samples.",
    providerUrl: "https://bazaar.abuse.ch/",
    authFields: [OPTIONAL_API_KEY],
    settingsFields: [
      MAX_RECORDS,
      { key: "signature_filter", label: "Signature Filter", type: "textarea", required: false, placeholder: "Emotet\nQakBot\nIcedID", help: "Only ingest samples matching these malware families. One per line." },
    ],
    defaultIntervalMins: 60,
    minIntervalMins: 30,
    quotaInfo: "Public API. 100 results per query default.",
    parser: "json",
    implemented: true,
  },
];

// ─── Tier 3: Standard (30-60min) ──────────────────────────────────────

const TIER3_FEEDS: IntelFeedType[] = [
  {
    feedName: "sans_isc",
    displayName: "SANS ISC Top IPs",
    tier: 3,
    category: "reputation",
    icon: "🛡️",
    description: "SANS Internet Storm Center top attacking IPs. Aggregated from DShield honeypot sensors worldwide.",
    providerUrl: "https://isc.sans.edu/",
    authFields: [OPTIONAL_API_KEY],
    settingsFields: [
      { key: "record_count", label: "Top N IPs", type: "number", required: false, default: 100, help: "Number of top attacking IPs to fetch (10-500)." },
    ],
    defaultIntervalMins: 60,
    minIntervalMins: 30,
    quotaInfo: "Public JSON API. No published rate limit.",
    parser: "json",
    implemented: true,
  },
  {
    feedName: "ransomwatch",
    displayName: "Ransomwatch",
    tier: 3,
    category: "threat",
    icon: "💀",
    description: "Tracks ransomware group leak sites and victim posts from dark web. Community maintained.",
    providerUrl: "https://github.com/joshhighet/ransomwatch",
    authFields: [OPTIONAL_API_KEY],
    settingsFields: [MAX_RECORDS],
    defaultIntervalMins: 360,
    minIntervalMins: 120,
    quotaInfo: "GitHub-hosted JSON. Updated multiple times daily.",
    parser: "json",
    implemented: true,
  },
  {
    feedName: "tor_exits",
    displayName: "Tor Exit Nodes",
    tier: 3,
    category: "infrastructure",
    icon: "🧅",
    description: "Current list of Tor exit node IP addresses from the Tor Project. Useful for access control and threat correlation.",
    providerUrl: "https://check.torproject.org/",
    authFields: [OPTIONAL_API_KEY],
    settingsFields: [],
    defaultIntervalMins: 60,
    minIntervalMins: 30,
    quotaInfo: "Public text feed. Updated hourly.",
    parser: "text",
    implemented: true,
  },
  {
    feedName: "ipsum",
    displayName: "IPsum Reputation",
    tier: 3,
    category: "reputation",
    icon: "📋",
    description: "Aggregated IP reputation list from 30+ blocklists. Multi-list overlap scoring for high confidence.",
    providerUrl: "https://github.com/stamparm/ipsum",
    authFields: [OPTIONAL_API_KEY],
    settingsFields: [
      { key: "min_lists", label: "Min Blocklist Count", type: "number", required: false, default: 3, help: "Only include IPs appearing on N+ blocklists (1-10). Higher = more confidence." },
    ],
    defaultIntervalMins: 360,
    minIntervalMins: 120,
    quotaInfo: "GitHub-hosted. Updated daily.",
    parser: "text",
    implemented: true,
  },
  {
    feedName: "spamhaus_drop",
    displayName: "Spamhaus DROP",
    tier: 3,
    category: "reputation",
    icon: "🚫",
    description: "Don't Route Or Peer list. CIDR ranges hijacked or leased by professional spam/cyber-crime operations.",
    providerUrl: "https://www.spamhaus.org/blocklists/do-not-route-or-peer/",
    authFields: [OPTIONAL_API_KEY],
    settingsFields: [],
    defaultIntervalMins: 360,
    minIntervalMins: 120,
    quotaInfo: "Public text feed. Updated ~daily.",
    parser: "text",
    implemented: true,
  },
  {
    feedName: "blocklist_de",
    displayName: "Blocklist.de",
    tier: 3,
    category: "reputation",
    icon: "🛑",
    description: "IP addresses reported for attacks on honeypots, mail servers, and web applications. Large volume.",
    providerUrl: "https://www.blocklist.de/",
    authFields: [OPTIONAL_API_KEY],
    settingsFields: [MAX_RECORDS],
    defaultIntervalMins: 360,
    minIntervalMins: 120,
    quotaInfo: "Public text feed. Updated multiple times daily.",
    parser: "text",
    implemented: true,
  },
];

// ─── Tier 4: Social/OSINT (60min) ────────────────────────────────────

const TIER4_FEEDS: IntelFeedType[] = [
  {
    feedName: "tweetfeed",
    displayName: "TweetFeed IOCs",
    tier: 4,
    category: "social",
    icon: "🐦",
    description: "IOCs extracted from security researcher tweets. CSV format with URL, IP, domain, and hash indicators.",
    providerUrl: "https://github.com/0xDanielLopez/TweetFeed",
    authFields: [OPTIONAL_API_KEY],
    settingsFields: [IOC_TYPES_FILTER, CONFIDENCE_THRESHOLD],
    defaultIntervalMins: 30,
    minIntervalMins: 15,
    quotaInfo: "GitHub-hosted CSV. Updated multiple times daily.",
    parser: "csv",
    implemented: true,
  },
  {
    feedName: "mastodon_iocs",
    displayName: "Mastodon IOCs",
    tier: 4,
    category: "social",
    icon: "🐘",
    description: "IOCs shared on the ioc.exchange Mastodon instance by threat researchers. Covers emerging threats early.",
    providerUrl: "https://ioc.exchange/",
    authFields: [
      { key: "api_key", label: "Access Token (optional)", type: "password", required: false, help: "Optional. Increases rate limits. Register at ioc.exchange." },
    ],
    settingsFields: [
      { key: "instance", label: "Instance", type: "text", required: false, default: "ioc.exchange", placeholder: "ioc.exchange", help: "Mastodon instance hostname." },
      MAX_RECORDS,
    ],
    defaultIntervalMins: 30,
    minIntervalMins: 15,
    quotaInfo: "300 req/5 min unauthenticated. Higher with token.",
    parser: "json",
    implemented: true,
  },
];

// ─── Tier 5: API-Dependent (30-120min, require keys) ─────────────────

const TIER5_FEEDS: IntelFeedType[] = [
  {
    feedName: "abuseipdb",
    displayName: "AbuseIPDB",
    tier: 5,
    category: "reputation",
    icon: "🔍",
    description: "Community-reported abusive IP addresses with confidence scores. Enterprise-grade IP reputation scoring.",
    providerUrl: "https://www.abuseipdb.com/",
    authFields: [
      { key: "api_key", label: "API Key", type: "password", required: true, placeholder: "your-abuseipdb-key", help: "Create a free account at abuseipdb.com to get an API key." },
    ],
    settingsFields: [
      CONFIDENCE_THRESHOLD,
      { key: "limit", label: "Results Limit", type: "number", required: false, default: 100, help: "Max IPs to pull per request (10-10000). Free plan: 1000 reports/day." },
    ],
    defaultIntervalMins: 360,
    minIntervalMins: 60,
    quotaInfo: "Free: 1,000 reports/day, 5 checks/sec. Premium: higher limits.",
    parser: "json",
    implemented: true,
  },
  {
    feedName: "virustotal",
    displayName: "VirusTotal",
    tier: 5,
    category: "threat",
    icon: "🦠",
    description: "Multi-engine malware scanning and URL/domain reputation. Enrichment feed for existing IOCs.",
    providerUrl: "https://www.virustotal.com/",
    authFields: [
      { key: "api_key", label: "API Key", type: "password", required: true, placeholder: "your-vt-key", help: "Get a free API key at virustotal.com. Premium keys provide higher quotas." },
    ],
    settingsFields: [
      { key: "lookback_hours", label: "Lookback Hours", type: "number", required: false, default: 24, help: "Check IOCs seen in the last N hours." },
      MAX_RECORDS,
    ],
    defaultIntervalMins: 0,
    minIntervalMins: 0,
    quotaInfo: "Free: 4 req/min, 500 req/day. Premium: 30 req/min, unlimited.",
    parser: "json",
    implemented: true,
  },
  {
    feedName: "ipqs",
    displayName: "IPQualityScore",
    tier: 5,
    category: "reputation",
    icon: "🎯",
    description: "Fraud scoring for IPs, emails, and phone numbers. Detects proxies, VPNs, and bot traffic.",
    providerUrl: "https://www.ipqualityscore.com/",
    authFields: [
      { key: "api_key", label: "API Key", type: "password", required: true, placeholder: "your-ipqs-key", help: "Register at ipqualityscore.com for an API key." },
    ],
    settingsFields: [
      { key: "strictness", label: "Strictness Level", type: "select", required: false, default: "1", options: [
        { value: "0", label: "Low (fewer false positives)" },
        { value: "1", label: "Medium (balanced)" },
        { value: "2", label: "High (more aggressive)" },
      ]},
    ],
    defaultIntervalMins: 0,
    minIntervalMins: 0,
    quotaInfo: "Free: 5,000 lookups/mo. Paid plans from $20/mo.",
    parser: "json",
    implemented: true,
  },
];

// ─── Tier 6: Enrichment/Monitoring (60-360min) ──────────────────────

const TIER6_FEEDS: IntelFeedType[] = [
  {
    feedName: "certstream",
    displayName: "CertStream",
    tier: 6,
    category: "infrastructure",
    icon: "📜",
    description: "Real-time Certificate Transparency log monitor. Detects suspicious domain registrations and lookalike domains.",
    providerUrl: "https://certstream.calidog.io/",
    authFields: [OPTIONAL_API_KEY],
    settingsFields: [
      { key: "keyword_filter", label: "Domain Keywords", type: "textarea", required: false, placeholder: "paypal\nchase\namazon", help: "Only alert on certs containing these keywords. One per line." },
    ],
    defaultIntervalMins: 15,
    minIntervalMins: 5,
    quotaInfo: "WebSocket-based. Continuous stream, polled periodically.",
    parser: "json",
    implemented: true,
  },
  {
    feedName: "google_safebrowsing",
    displayName: "Google Safe Browsing",
    tier: 6,
    category: "threat",
    icon: "🔐",
    description: "Google's Safe Browsing threat lists covering malware, social engineering, and unwanted software.",
    providerUrl: "https://developers.google.com/safe-browsing",
    authFields: [
      { key: "api_key", label: "API Key", type: "password", required: true, placeholder: "AIzaSy...", help: "Create at console.cloud.google.com. Enable Safe Browsing API." },
    ],
    settingsFields: [],
    defaultIntervalMins: 60,
    minIntervalMins: 30,
    quotaInfo: "10,000 req/day free. Update API recommended over Lookup API.",
    parser: "json",
    implemented: true,
  },
  {
    feedName: "cloud_status",
    displayName: "Cloud Status Monitor",
    tier: 6,
    category: "infrastructure",
    icon: "☁️",
    description: "Monitors GCP, AWS, and Azure status pages for incidents affecting cloud infrastructure.",
    providerUrl: "https://status.cloud.google.com/",
    authFields: [OPTIONAL_API_KEY],
    settingsFields: [
      { key: "providers", label: "Cloud Providers", type: "textarea", required: false, placeholder: "gcp\naws\nazure", help: "One provider per line. Leave empty for all." },
    ],
    defaultIntervalMins: 15,
    minIntervalMins: 5,
    quotaInfo: "Public JSON feeds. Lightweight polling.",
    parser: "json",
    implemented: true,
  },
  {
    feedName: "cf_radar",
    displayName: "Cloudflare Radar",
    tier: 6,
    category: "infrastructure",
    icon: "🌐",
    description: "Cloudflare Radar attack analytics. Layer 3/4/7 DDoS attack summaries and internet traffic patterns.",
    providerUrl: "https://radar.cloudflare.com/",
    authFields: [
      { key: "api_key", label: "API Token", type: "password", required: true, placeholder: "your-cf-token", help: "Create an API token at dash.cloudflare.com with Radar read permissions." },
    ],
    settingsFields: [],
    defaultIntervalMins: 60,
    minIntervalMins: 30,
    quotaInfo: "Requires Cloudflare account. API token with Radar access.",
    parser: "json",
    implemented: true,
  },
  {
    feedName: "bgpstream",
    displayName: "BGPStream",
    tier: 6,
    category: "infrastructure",
    icon: "🔀",
    description: "BGP hijack and route leak detection from Cisco Crosswork. Monitors for suspicious routing changes.",
    providerUrl: "https://bgpstream.crosswork.cisco.com/",
    authFields: [OPTIONAL_API_KEY],
    settingsFields: [
      { key: "event_types", label: "Event Types", type: "textarea", required: false, placeholder: "Possible Hijack\nRoute Leak", help: "Filter by event type. One per line. Leave empty for all." },
    ],
    defaultIntervalMins: 60,
    minIntervalMins: 30,
    quotaInfo: "Public API. Moderate rate limits.",
    parser: "json",
    implemented: true,
  },
  {
    feedName: "greynoise",
    displayName: "GreyNoise",
    tier: 6,
    category: "reputation",
    icon: "📡",
    description: "Internet-wide scan and attack traffic analysis. Identifies benign scanners vs. malicious actors.",
    providerUrl: "https://www.greynoise.io/",
    authFields: [
      { key: "api_key", label: "API Key", type: "password", required: true, placeholder: "your-greynoise-key", help: "Free community API: 50 req/day. Paid: unlimited." },
    ],
    settingsFields: [
      { key: "classification", label: "Classification Filter", type: "select", required: false, default: "malicious", options: [
        { value: "all", label: "All classifications" },
        { value: "malicious", label: "Malicious only" },
        { value: "benign", label: "Benign only" },
      ]},
    ],
    defaultIntervalMins: 360,
    minIntervalMins: 60,
    quotaInfo: "Community: 50 req/day. Enterprise: unlimited.",
    parser: "json",
    implemented: true,
  },
  {
    feedName: "otx_pulses",
    displayName: "AlienVault OTX",
    tier: 6,
    category: "threat",
    icon: "👽",
    description: "Open Threat Exchange community-curated threat intelligence pulses. Wide coverage of IOCs and TTPs.",
    providerUrl: "https://otx.alienvault.com/",
    authFields: [
      { key: "api_key", label: "OTX Key", type: "password", required: true, placeholder: "your-otx-key", help: "Register at otx.alienvault.com for a free API key." },
    ],
    settingsFields: [
      MAX_RECORDS,
      { key: "modified_since_days", label: "Modified Since (days)", type: "number", required: false, default: 1, help: "Fetch pulses modified in the last N days." },
    ],
    defaultIntervalMins: 60,
    minIntervalMins: 30,
    quotaInfo: "Free: 10,000 req/hr. Generous limits.",
    parser: "json",
    implemented: true,
  },
];

// ─── Custom feed template ───────────────────────────────────────────

const CUSTOM_FEED: IntelFeedType = {
  feedName: "custom",
  displayName: "Custom Feed",
  tier: 3,
  category: "threat",
  icon: "🔧",
  description: "Add a custom threat intelligence feed. Provide your own URL, parser configuration, and auth details.",
  providerUrl: "",
  authFields: [
    { key: "api_key", label: "API Key / Token (optional)", type: "password", required: false, placeholder: "Bearer token or API key", help: "Include if the feed requires authentication." },
  ],
  settingsFields: [
    { key: "feed_url", label: "Feed URL", type: "text", required: true, placeholder: "https://example.com/feed.json", help: "The URL to fetch IOC data from." },
    { key: "http_method", label: "HTTP Method", type: "select", required: false, default: "GET", options: [
      { value: "GET", label: "GET" },
      { value: "POST", label: "POST" },
    ]},
    { key: "custom_headers", label: "Custom Headers (JSON)", type: "textarea", required: false, placeholder: '{"X-Custom": "value"}', help: "Additional HTTP headers as JSON object." },
    { key: "parser_type", label: "Parser", type: "select", required: true, default: "json", options: [
      { value: "json", label: "JSON" },
      { value: "csv", label: "CSV" },
      { value: "text", label: "Plain Text (one IOC per line)" },
      { value: "xml", label: "XML" },
    ]},
    { key: "ioc_path", label: "IOC JSON Path", type: "text", required: false, placeholder: "data.iocs", help: "Dot-notation path to the IOC array in JSON response." },
    IOC_TYPES_FILTER,
    MAX_RECORDS,
    SEVERITY_FILTER,
    CONFIDENCE_THRESHOLD,
  ],
  defaultIntervalMins: 60,
  minIntervalMins: 5,
  quotaInfo: "Depends on provider. Configure interval accordingly.",
  parser: "custom",
  implemented: true,
};

// ─── Flat catalog and maps ──────────────────────────────────────────

export const INTEL_FEED_CATALOG: IntelFeedType[] = [
  ...TIER1_FEEDS,
  ...TIER2_FEEDS,
  ...TIER3_FEEDS,
  ...TIER4_FEEDS,
  ...TIER5_FEEDS,
  ...TIER6_FEEDS,
  CUSTOM_FEED,
];

export const INTEL_FEED_MAP: Record<string, IntelFeedType> = Object.fromEntries(
  INTEL_FEED_CATALOG.map((f) => [f.feedName, f])
);

export const TIER_GROUPS: Record<FeedTier | "custom", IntelFeedType[]> = {
  1: TIER1_FEEDS,
  2: TIER2_FEEDS,
  3: TIER3_FEEDS,
  4: TIER4_FEEDS,
  5: TIER5_FEEDS,
  6: TIER6_FEEDS,
  custom: [CUSTOM_FEED],
};

export const TIER_LABELS: Record<FeedTier, string> = {
  1: "Tier 1 — Real-time Critical",
  2: "Tier 2 — High Priority",
  3: "Tier 3 — Standard",
  4: "Tier 4 — Social / OSINT",
  5: "Tier 5 — API-dependent",
  6: "Tier 6 — Enrichment",
};

export const TIER_COLORS: Record<FeedTier | "custom", { badge: string; dot: string; border: string }> = {
  1:      { badge: "bg-threat-critical/10 border-threat-critical/30 text-threat-critical", dot: "bg-threat-critical", border: "border-threat-critical/30" },
  2:      { badge: "bg-threat-high/10 border-threat-high/30 text-threat-high",             dot: "bg-threat-high",     border: "border-threat-high/30" },
  3:      { badge: "bg-blue-500/10 border-blue-500/30 text-blue-500",                      dot: "bg-blue-500",        border: "border-blue-500/30" },
  4:      { badge: "bg-violet-400/10 border-violet-400/30 text-violet-400",                dot: "bg-violet-400",      border: "border-violet-400/30" },
  5:      { badge: "bg-amber-400/10 border-amber-400/30 text-amber-400",                   dot: "bg-amber-400",       border: "border-amber-400/30" },
  6:      { badge: "bg-blue-400/10 border-blue-400/30 text-blue-400",                      dot: "bg-blue-400",        border: "border-blue-400/30" },
  custom: { badge: "bg-slate-400/10 border-slate-400/30 text-slate-400",                   dot: "bg-slate-400",       border: "border-slate-400/30" },
};

export const CATEGORY_ICONS: Record<string, string> = {
  threat: "🎯",
  vulnerability: "🔓",
  reputation: "📊",
  social: "👥",
  infrastructure: "🏗️",
};
