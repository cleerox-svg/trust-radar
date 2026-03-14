import type { FeedModule } from "./types";

// ─── MVP Feed Modules (Phase 1) ─────────────────────────────────
import { certstream } from "./certstream";
import { phishtank } from "./phishtank";
import { urlhaus } from "./urlhaus";
import { openphish } from "./openphish";
import { threatfox } from "./threatfox";
import { feodo } from "./feodo";

/**
 * Registry mapping feed_name → FeedModule.
 * Keys match feed_configs.feed_name in the database.
 *
 * Phase 1 (MVP): 6 free, high-quality feeds
 * Phase 2+: Add provider intel feeds (Cloudflare Radar, VirusTotal, etc.)
 */
export const feedModules: Record<string, FeedModule> = {
  ct_logs: certstream,
  phishtank,
  urlhaus,
  openphish,
  threatfox,
  feodo,
};
