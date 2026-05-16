// Intel Hotlist Home section — PR-A from the 2026-05-16 platform audit.
//
// Three sub-cards (collapse to one on narrow viewports) surfacing
// intel that was already in the DB but never reached the UI:
//
//   1. Top fan-out IPs        — IPs hitting many distinct brands
//   2. Multi-feed consensus   — IPs flagged by ≥4 independent feeds
//   3. Recent bursts          — domain swarms targeting one brand
//                               in a tight time window
//
// Sits below DailyBriefing/LatestIntel — these are raw signals
// (IPs / counts / windows) rather than narrative content.

import { useNavigate } from 'react-router-dom';
import { useIntelHotlist } from '@/hooks/useIntelHotlist';
import type { FanoutIp, ConsensusIp, Burst } from '@/hooks/useIntelHotlist';

function relTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// SQLite returns datetimes as "2026-05-16 19:00:45" (no 'T', no 'Z').
// Date.parse on a string like that is timezone-ambiguous. Append 'Z'
// to force UTC interpretation — matches the existing date-format
// rule used throughout the worker.
function relTimeFromSqlite(s: string): string {
  return relTime(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
}

export function IntelHotlist() {
  const navigate = useNavigate();
  const { data, isLoading } = useIntelHotlist(5);

  const fanout = data?.top_fanout_ips ?? [];
  const consensus = data?.multi_feed_consensus ?? [];
  const bursts = data?.recent_bursts ?? [];

  // Hide the section entirely if every sub-card is empty — operator
  // sees nothing instead of three "no data" placeholders. Loading
  // state still renders so the section doesn't pop in.
  const allEmpty = !isLoading && fanout.length === 0 && consensus.length === 0 && bursts.length === 0;
  if (allEmpty) return null;

  return (
    <section className="home-intel-hotlist">
      <header className="home-intel-hotlist-header">
        <span className="home-intel-hotlist-label">Intel Hotlist</span>
        <span className="home-intel-hotlist-sublabel">
          High-signal IOCs from the threat corpus
        </span>
      </header>

      <div className="home-intel-hotlist-grid">
        {fanout.length > 0 && (
          <SubCard title="Mass-impersonation IPs" tone="sev-critical">
            <ul className="home-intel-hotlist-rows">
              {fanout.slice(0, 5).map((row: FanoutIp) => (
                <li key={row.ip_address}>
                  <button
                    type="button"
                    onClick={() => navigate(`/threats?ip=${encodeURIComponent(row.ip_address)}`)}
                    className="home-intel-hotlist-row"
                    title={`${row.threat_count.toLocaleString()} active threats · ${row.brand_count} brands · last seen ${row.last_seen}`}
                  >
                    <code className="home-intel-hotlist-ip">{row.ip_address}</code>
                    <span className="home-intel-hotlist-metric">
                      <strong>{row.brand_count}</strong> brands · {row.threat_count.toLocaleString()} threats
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </SubCard>
        )}

        {consensus.length > 0 && (
          <SubCard title="Multi-feed consensus" tone="sev-high">
            <ul className="home-intel-hotlist-rows">
              {consensus.slice(0, 5).map((row: ConsensusIp) => (
                <li key={row.ip_address}>
                  <button
                    type="button"
                    onClick={() => navigate(`/threats?ip=${encodeURIComponent(row.ip_address)}`)}
                    className="home-intel-hotlist-row"
                    title={`Flagged by: ${row.feeds}`}
                  >
                    <code className="home-intel-hotlist-ip">{row.ip_address}</code>
                    <span className="home-intel-hotlist-metric">
                      <strong>{row.feed_count}</strong> feeds · {row.threat_count.toLocaleString()} threats
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </SubCard>
        )}

        {bursts.length > 0 && (
          <SubCard title="Recent bursts (24h)" tone="amber">
            <ul className="home-intel-hotlist-rows">
              {bursts.slice(0, 5).map((b: Burst) => (
                <li key={`${b.brand_id}-${b.hour_bucket}`}>
                  <button
                    type="button"
                    onClick={() => navigate(`/brands/${encodeURIComponent(b.brand_id)}`)}
                    className="home-intel-hotlist-row"
                    title={`${b.distinct_domains.toLocaleString()} distinct domains · burst window ${b.burst_start} → ${b.burst_end}`}
                  >
                    <span className="home-intel-hotlist-brand">{b.brand_name}</span>
                    <span className="home-intel-hotlist-metric">
                      <strong>{b.threat_count}</strong> in 1h · {relTimeFromSqlite(b.hour_bucket)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </SubCard>
        )}
      </div>

      <style>{`
        .home-intel-hotlist {
          margin: 12px 24px 0;
          padding: 12px 16px;
          border-radius: 12px;
          background: linear-gradient(160deg, var(--bg-card), var(--bg-card-deep));
          border: 1px solid var(--border-base);
        }
        .home-intel-hotlist-header {
          display: flex;
          align-items: baseline;
          gap: 12px;
          margin-bottom: 10px;
        }
        .home-intel-hotlist-label {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--text-tertiary);
        }
        .home-intel-hotlist-sublabel {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
        }
        .home-intel-hotlist-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr;
        }
        @container home (min-width: 720px) {
          .home-intel-hotlist-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        .home-intel-hotlist-rows {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .home-intel-hotlist-row {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          background: none;
          border: none;
          padding: 6px 4px;
          border-radius: 6px;
          color: var(--text-primary);
          cursor: pointer;
          text-align: left;
        }
        .home-intel-hotlist-row:hover {
          background: var(--bg-input);
        }
        .home-intel-hotlist-ip {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-primary);
        }
        .home-intel-hotlist-brand {
          font-size: 13px;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .home-intel-hotlist-metric {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-tertiary);
          flex-shrink: 0;
        }
        .home-intel-hotlist-metric strong {
          color: var(--text-primary);
          font-weight: 600;
        }
      `}</style>
    </section>
  );
}

function SubCard({
  title,
  tone,
  children,
}: {
  title: string;
  tone: 'sev-critical' | 'sev-high' | 'amber';
  children: React.ReactNode;
}) {
  const accent =
    tone === 'sev-critical' ? 'var(--sev-critical)' :
    tone === 'sev-high'     ? 'var(--sev-high)' :
                              'var(--amber)';
  return (
    <div className="home-intel-hotlist-subcard">
      <div className="home-intel-hotlist-subtitle" style={{ color: accent }}>
        {title}
      </div>
      {children}
      <style>{`
        .home-intel-hotlist-subcard {
          padding: 8px 10px;
          border-radius: 8px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-base);
        }
        .home-intel-hotlist-subtitle {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
      `}</style>
    </div>
  );
}
