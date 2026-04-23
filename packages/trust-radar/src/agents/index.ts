/**
 * Agent registry — maps agent names to modules.
 *
 * Canonical agents:
 *   sentinel (5min/event), analyst (15min), cartographer (15min), strategist (6h),
 *   observer (daily), nexus (4h), pathfinder (weekly), sparrow (6h)
 */

import type { AgentModule } from "../lib/agentRunner";

import { sentinelAgent } from "./sentinel";
import { analystAgent } from "./analyst";
import { cartographerAgent } from "./cartographer";
import { strategistAgent } from "./strategist";
import { observerAgent } from "./observer";
import { pathfinderAgent } from "./pathfinder";
import { sparrowAgent } from "./sparrow";
import { nexusAgent } from "./nexus";
import { flightControlAgent } from "./flightControl";
import { curatorAgent } from "./curator";
import { watchdogAgent } from "./watchdog";
import { architectAgent } from "./architect";
import { narratorAgent } from "./narrator";
import { appStoreMonitorAgent } from "./appStoreMonitor";
import { darkWebMonitorAgent } from "./darkWebMonitor";

// TrustBot is a utility module for the /api/trustbot/chat endpoint — not a scheduled/event agent
export { trustbotAgent } from "./trustbot";

export const agentModules: Record<string, AgentModule> = {
  "sentinel": sentinelAgent,
  "analyst": analystAgent,
  "cartographer": cartographerAgent,
  "strategist": strategistAgent,
  "observer": observerAgent,
  "pathfinder": pathfinderAgent,
  "sparrow": sparrowAgent,
  "nexus": nexusAgent,
  "flight_control": flightControlAgent,
  "curator": curatorAgent,
  "watchdog": watchdogAgent,
  "architect": architectAgent,
  "narrator": narratorAgent,
  "app_store_monitor": appStoreMonitorAgent,
  "dark_web_monitor": darkWebMonitorAgent,
};
