import type { FeedModule } from "./types";

// Tier 1 — Real-time critical feeds (5min interval)
import { threatfox } from "./threatfox";
import { feodo } from "./feodo";
import { phishtank } from "./phishtank";

// Tier 2 — High-priority feeds (15min interval)
import { cisa_kev } from "./cisa_kev";
import { sslbl } from "./sslbl";
import { malbazaar } from "./malbazaar";

// Tier 3 — Standard feeds (30-60min interval)
import { sans_isc } from "./sans_isc";
import { ransomwatch } from "./ransomwatch";
import { tor_exits } from "./tor_exits";
import { ipsum } from "./ipsum";
import { spamhaus } from "./spamhaus";
import { blocklist_de } from "./blocklist_de";

// Tier 4 — Social/OSINT feeds (60min interval)
import { tweetfeed } from "./tweetfeed";
import { mastodon_ioc } from "./mastodon_ioc";

// Tier 5 — API-dependent feeds (30-120min, require keys)
import { abuseipdb } from "./abuseipdb";
import { virustotal } from "./virustotal";
import { ipqs } from "./ipqs";

// Tier 6 — Enrichment/monitoring feeds (60-360min)
import { certstream } from "./certstream";
import { safebrowsing } from "./safebrowsing";
import { cloud_status } from "./cloud_status";
import { cf_radar } from "./cf_radar";
import { bgpstream } from "./bgpstream";
import { greynoise } from "./greynoise";
import { otx } from "./otx";

/** Registry mapping feed_name → FeedModule (matches feed_schedules.feed_name) */
export const feedModules: Record<string, FeedModule> = {
  // Tier 1
  threatfox,
  feodo,
  phishtank,
  // Tier 2
  cisa_kev,
  sslbl,
  malbazaar,
  // Tier 3
  sans_isc,
  ransomwatch,
  tor_exits,
  ipsum,
  spamhaus,
  blocklist_de,
  // Tier 4
  tweetfeed,
  mastodon_ioc,
  // Tier 5
  abuseipdb,
  virustotal,
  ipqs,
  // Tier 6
  certstream,
  safebrowsing,
  cloud_status,
  cf_radar,
  bgpstream,
  greynoise,
  otx,
};
