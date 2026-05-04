// Phase 2.5 of the unified Home rebuild — Threat Pulse section.
//
// Reuses the ThreatInflowChart from /threats so we have one source
// of truth for the inflow visualization. Two intentional differences
// on Home:
//   - Default window is 7d (the chart defaults to 24h on /threats);
//     operators told us "default to 7d, allow other timeframes,
//     custom date range when drilling".
//   - Section padding aligns with the rest of the unified Home.
//
// The chart provides its own card chrome, headline number, footer
// stats, and 24H | 7D segmented control — no wrapping work needed
// here. Custom date range remains a /threats-only feature for now.

import { ThreatInflowChart } from '@/features/threats/ThreatInflowChart';

export function ThreatPulse() {
  return (
    <section className="home-threat-pulse">
      <ThreatInflowChart defaultWindow="7d" />
      <style>{`
        .home-threat-pulse {
          padding: 20px 24px 0;
        }
        @container home (min-width: 480px) {
          .home-threat-pulse { padding: 22px 32px 0; }
        }
      `}</style>
    </section>
  );
}
