import type { FeedModule } from "./types";

// ─── Feed Modules ───────────────────────────────────────────────
import { certstream } from "./certstream";
import { phishtank } from "./phishtank";
import { urlhaus } from "./urlhaus";
import { openphish } from "./openphish";
import { threatfox } from "./threatfox";
import { feodo } from "./feodo";
import { phishstats } from "./phishstats";
import { phishdestroy } from "./phishdestroy";
import { nrd_hagezi } from "./nrd_hagezi";
import { dshield } from "./dshield";
import { cins_army } from "./cins_army";
import { sslbl } from "./sslbl";

/**
 * Registry mapping feed_name → FeedModule.
 * Keys match feed_configs.feed_name in the database.
 */
export const feedModules: Record<string, FeedModule> = {
  ct_logs: certstream,
  phishtank,
  urlhaus,
  openphish,
  threatfox,
  feodo,
  phishstats,
  phishdestroy,
  nrd_hagezi,
  dshield,
  cins_army,
  sslbl,
};
