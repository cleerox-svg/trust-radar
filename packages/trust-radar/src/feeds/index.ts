import type { FeedModule } from "./types";

// ─── Feed Modules ───────────────────────────────────────────────
import { certstream } from "./certstream";
import { phishtank } from "./phishtank";
import { urlhaus } from "./urlhaus";
import { openphish } from "./openphish";
import { threatfox } from "./threatfox";
import { feodo } from "./feodo";
// PhishStats removed 2026-03 — service dead (522/404)
import { phishdestroy } from "./phishdestroy";
import { nrd_hagezi } from "./nrd_hagezi";
import { dshield } from "./dshield";
import { cins_army } from "./cins_army";
import { sslbl } from "./sslbl";
import { cloudflare_scanner } from "./cloudflare_scanner";
import { cloudflare_email } from "./cloudflare_email";
import { otx_alienvault } from "./otx_alienvault";
import { cisa_kev } from "./cisa_kev";
import { malwarebazaar } from "./malwarebazaar";

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
  phishdestroy,
  nrd_hagezi,
  dshield,
  cins_army,
  sslbl,
  cloudflare_scanner,
  cloudflare_email,
  otx_alienvault,
  cisa_kev,
  malwarebazaar,
};
