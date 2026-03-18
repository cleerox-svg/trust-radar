/**
 * BrandReport — Standalone print-optimized threat intelligence report.
 * Accessed at /report/:brandId?period=7d|30d|90d
 * Uses window.print() for PDF export.
 */

import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

const BASE = "/api";
function getToken() { return localStorage.getItem("imprsn8_token"); }

interface ReportData {
  reportId: string;
  generatedAt: string;
  period: { label: string; days: number; start: string; end: string };
  brand: { id: string; name: string; canonical_domain: string; logo_url: string };
  executive: {
    trustScore: number; riskLevel: string; totalThreats: number; activeThreats: number;
    remediatedThreats: number; countriesInvolved: number; campaignsIdentified: number;
    hostingProviders: number; aiSummary: string;
  };
  threatBreakdown: {
    byType: Array<{ type: string; count: number }>;
    bySeverity: Array<{ severity: string; count: number }>;
    topThreats: Array<{
      id: string; malicious_url: string | null; malicious_domain: string | null;
      threat_type: string; severity: string; status: string; first_seen: string;
    }>;
  };
  campaigns: Array<{ id: string; name: string; status: string; threat_count: number; first_seen: string; last_seen: string }>;
  infrastructure: {
    providers: Array<{ name: string; threat_count: number; active_count: number }>;
    countries: Array<{ country_code: string; count: number }>;
    asns: Array<{ asn: string; count: number }>;
  };
  timeline: Array<{ period: string; count: number; phishing: number; typosquatting: number; malware: number }>;
  recommendations: string[];
}

const COLORS = ["#6D40ED", "#E8163B", "#F0A500", "#22D3EE", "#16A34A", "#FDA4AE", "#FCD34D", "#8B6FF5"];
const SEV_COLORS: Record<string, string> = { critical: "#E8163B", high: "#F0A500", medium: "#22D3EE", low: "#16A34A", info: "#64748B" };

function letterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return iso; }
}

function capitalize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function BrandReport() {
  const { brandId } = useParams();
  const [searchParams] = useSearchParams();
  const period = searchParams.get("period") ?? "30d";
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!brandId) return;
    setLoading(true);
    fetch(`${BASE}/brands/${brandId}/report?period=${period}`, {
      headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then((j: { success: boolean; data?: ReportData; error?: string }) => {
        if (j.success && j.data) setReport(j.data);
        else setError(j.error ?? "Failed to generate report");
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [brandId, period]);

  if (loading) return <div style={styles.loadingPage}><div style={styles.spinner} /><p style={{ color: "#8B6FF5", marginTop: 16 }}>Generating threat intelligence report...</p></div>;
  if (error || !report) return <div style={styles.loadingPage}><p style={{ color: "#E8163B" }}>Error: {error}</p></div>;

  const r = report;
  return (
    <div style={styles.body}>
      {/* Download bar */}
      <div className="report-download-bar" style={styles.downloadBar}>
        <span style={{ fontSize: 13, color: "#94a3b8" }}>Trust Radar — Threat Intelligence Report</span>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            defaultValue={period}
            onChange={e => { window.location.search = `?period=${e.target.value}`; }}
            style={styles.periodSelect}
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button onClick={() => window.print()} style={styles.downloadBtn}>Download PDF</button>
        </div>
      </div>

      {/* PAGE 1 — COVER */}
      <div className="report-page" style={styles.page}>
        <div style={styles.coverPage}>
          <div style={styles.coverLogo}>
            <svg width="48" height="48" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="15" stroke="#6D40ED" strokeWidth="2"/><path d="M16 6L8 12v8l8 6 8-6v-8L16 6z" fill="#6D40ED" fillOpacity="0.15" stroke="#6D40ED" strokeWidth="1.5"/><circle cx="16" cy="16" r="4" fill="#6D40ED"/></svg>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginLeft: 12, letterSpacing: "-0.02em" }}>Trust Radar</span>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#8B6FF5", textTransform: "uppercase", marginBottom: 24 }}>Brand Threat Intelligence Report</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
              <img src={r.brand.logo_url} alt="" width={64} height={64} style={{ borderRadius: 12, background: "#1a1720" }} />
              <div>
                <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: "-0.02em" }}>{r.brand.name}</div>
                <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 4 }}>{r.brand.canonical_domain}</div>
              </div>
            </div>
            <div style={{ fontSize: 16, color: "#cbd5e1", marginBottom: 8 }}>{r.period.label}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 32 }}>Generated {new Date(r.generatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
            <div style={styles.tlpBadge}>TLP:AMBER</div>
          </div>
          <div style={{ fontSize: 11, color: "#475569", textAlign: "center", paddingBottom: 24 }}>
            Confidential — Prepared by Trust Radar | LRX Enterprises Inc.
          </div>
        </div>
        <Footer reportId={r.reportId} page={1} />
      </div>

      {/* PAGE 2 — EXECUTIVE SUMMARY */}
      <div className="report-page" style={styles.page}>
        <PageHeader title="Executive Summary" />
        <div style={{ display: "flex", gap: 32, marginBottom: 32 }}>
          <div style={styles.scoreRingContainer}>
            <svg width="160" height="160" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="70" fill="none" stroke="#1e1b2e" strokeWidth="12" />
              <circle cx="80" cy="80" r="70" fill="none" stroke={r.executive.trustScore >= 60 ? "#16A34A" : r.executive.trustScore >= 40 ? "#F0A500" : "#E8163B"} strokeWidth="12" strokeDasharray={`${(r.executive.trustScore / 100) * 440} 440`} strokeLinecap="round" transform="rotate(-90 80 80)" />
              <text x="80" y="72" textAnchor="middle" fill="#fff" fontSize="42" fontWeight="800">{letterGrade(r.executive.trustScore)}</text>
              <text x="80" y="100" textAnchor="middle" fill="#94a3b8" fontSize="14">{r.executive.trustScore}/100</text>
            </svg>
            <div style={{ ...styles.riskBadge, background: r.executive.riskLevel === "Critical" ? "#7A0018" : r.executive.riskLevel === "High" ? "#8A5900" : r.executive.riskLevel === "Medium" ? "#1e3a5f" : "#0a3a1e" }}>
              {r.executive.riskLevel} Risk
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={styles.metricsGrid}>
              <MetricCard label="Total Threats" value={r.executive.totalThreats} />
              <MetricCard label="Active Threats" value={r.executive.activeThreats} color="#E8163B" />
              <MetricCard label="Remediated" value={r.executive.remediatedThreats} color="#16A34A" />
              <MetricCard label="Countries" value={r.executive.countriesInvolved} />
              <MetricCard label="Campaigns" value={r.executive.campaignsIdentified} />
              <MetricCard label="Hosting Providers" value={r.executive.hostingProviders} />
            </div>
          </div>
        </div>
        <div style={styles.section}>
          <div style={styles.sectionTitle}>AI Threat Summary</div>
          <p style={styles.bodyText}>{r.executive.aiSummary}</p>
        </div>
        <Footer reportId={r.reportId} page={2} />
      </div>

      {/* PAGE 3 — THREAT BREAKDOWN */}
      <div className="report-page" style={styles.page}>
        <PageHeader title="Threat Breakdown" />
        <div style={{ display: "flex", gap: 24, marginBottom: 24 }}>
          <div style={{ ...styles.chartCard, flex: 1 }}>
            <div style={styles.chartTitle}>Threats by Type</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={r.threatBreakdown.byType} dataKey="count" nameKey="type" cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2}>
                  {r.threatBreakdown.byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a1720", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={styles.legend}>
              {r.threatBreakdown.byType.map((t, i) => (
                <span key={t.type} style={styles.legendItem}><span style={{ ...styles.legendDot, background: COLORS[i % COLORS.length] }} />{capitalize(t.type)} ({t.count})</span>
              ))}
            </div>
          </div>
          <div style={{ ...styles.chartCard, flex: 1 }}>
            <div style={styles.chartTitle}>Threats by Severity</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={r.threatBreakdown.bySeverity} layout="vertical">
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis type="category" dataKey="severity" tick={{ fill: "#94a3b8", fontSize: 11 }} width={60} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {r.threatBreakdown.bySeverity.map(s => <Cell key={s.severity} fill={SEV_COLORS[s.severity] ?? "#64748B"} />)}
                </Bar>
                <Tooltip contentStyle={{ background: "#1a1720", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Top 10 Most Recent Threats</div>
          <table style={styles.table}>
            <thead><tr>
              <th style={styles.th}>Domain / URL</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Severity</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>First Seen</th>
            </tr></thead>
            <tbody>
              {r.threatBreakdown.topThreats.map(t => (
                <tr key={t.id}>
                  <td style={styles.td}>{t.malicious_domain ?? t.malicious_url ?? "—"}</td>
                  <td style={styles.td}>{capitalize(t.threat_type)}</td>
                  <td style={styles.td}><SeverityDot severity={t.severity} /></td>
                  <td style={styles.td}>{capitalize(t.status)}</td>
                  <td style={styles.td}>{formatDate(t.first_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Footer reportId={r.reportId} page={3} />
      </div>

      {/* PAGE 4 — CAMPAIGN INTELLIGENCE */}
      <div className="report-page" style={styles.page}>
        <PageHeader title="Campaign Intelligence" />
        {r.campaigns.length === 0 ? (
          <div style={styles.emptyState}>No campaigns identified in this period.</div>
        ) : (
          <table style={styles.table}>
            <thead><tr>
              <th style={styles.th}>Campaign</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Threats</th>
              <th style={styles.th}>First Seen</th>
              <th style={styles.th}>Last Seen</th>
            </tr></thead>
            <tbody>
              {r.campaigns.map(c => (
                <tr key={c.id}>
                  <td style={{ ...styles.td, fontWeight: 600 }}>{c.name}</td>
                  <td style={styles.td}>{capitalize(c.status)}</td>
                  <td style={styles.td}>{c.threat_count}</td>
                  <td style={styles.td}>{formatDate(c.first_seen)}</td>
                  <td style={styles.td}>{formatDate(c.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Footer reportId={r.reportId} page={4} />
      </div>

      {/* PAGE 5 — INFRASTRUCTURE MAP */}
      <div className="report-page" style={styles.page}>
        <PageHeader title="Infrastructure Map" />
        <div style={{ display: "flex", gap: 24, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={styles.sectionTitle}>Top Hosting Providers</div>
            <table style={styles.table}>
              <thead><tr><th style={styles.th}>Provider</th><th style={styles.th}>Threats</th><th style={styles.th}>Active</th></tr></thead>
              <tbody>
                {r.infrastructure.providers.map(p => (
                  <tr key={p.name}><td style={styles.td}>{p.name}</td><td style={styles.td}>{p.threat_count}</td><td style={styles.td}>{p.active_count}</td></tr>
                ))}
                {r.infrastructure.providers.length === 0 && <tr><td colSpan={3} style={styles.td}>No provider data</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ flex: 1 }}>
            <div style={styles.sectionTitle}>Country Distribution</div>
            <table style={styles.table}>
              <thead><tr><th style={styles.th}>Country</th><th style={styles.th}>Threats</th></tr></thead>
              <tbody>
                {r.infrastructure.countries.map(c => (
                  <tr key={c.country_code}><td style={styles.td}>{c.country_code}</td><td style={styles.td}>{c.count}</td></tr>
                ))}
                {r.infrastructure.countries.length === 0 && <tr><td colSpan={2} style={styles.td}>No country data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        {r.infrastructure.asns.length > 0 && (
          <div>
            <div style={styles.sectionTitle}>ASN Information</div>
            <table style={styles.table}>
              <thead><tr><th style={styles.th}>ASN</th><th style={styles.th}>Threats</th></tr></thead>
              <tbody>
                {r.infrastructure.asns.map(a => (
                  <tr key={a.asn}><td style={styles.td}>{a.asn}</td><td style={styles.td}>{a.count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Footer reportId={r.reportId} page={5} />
      </div>

      {/* PAGE 6 — TIMELINE */}
      <div className="report-page" style={styles.page}>
        <PageHeader title="Threat Timeline" />
        <div style={styles.chartCard}>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={r.timeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#1a1720", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="phishing" stackId="1" stroke="#E8163B" fill="rgba(232,22,59,0.3)" name="Phishing" />
              <Area type="monotone" dataKey="typosquatting" stackId="1" stroke="#6D40ED" fill="rgba(109,64,237,0.3)" name="Typosquatting" />
              <Area type="monotone" dataKey="malware" stackId="1" stroke="#F0A500" fill="rgba(240,165,0,0.3)" name="Malware / C2" />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ ...styles.legend, marginTop: 12 }}>
            <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#E8163B" }} />Phishing</span>
            <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#6D40ED" }} />Typosquatting</span>
            <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#F0A500" }} />Malware / C2</span>
          </div>
        </div>
        <Footer reportId={r.reportId} page={6} />
      </div>

      {/* PAGE 7 — RECOMMENDATIONS */}
      <div className="report-page" style={styles.page}>
        <PageHeader title="Recommendations" />
        <div style={styles.section}>
          <div style={styles.sectionTitle}>AI-Generated Recommendations</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {r.recommendations.map((rec, i) => (
              <div key={i} style={styles.recCard}>
                <span style={styles.recNumber}>{i + 1}</span>
                <span style={styles.bodyText}>{rec}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...styles.section, marginTop: 40 }}>
          <div style={styles.sectionTitle}>Standard Best Practices</div>
          <ul style={{ ...styles.bodyText, paddingLeft: 20, listStyleType: "disc", display: "flex", flexDirection: "column", gap: 8 }}>
            <li>Monitor for new typosquatting domains daily</li>
            <li>Enforce DMARC, DKIM, and SPF to prevent email spoofing</li>
            <li>File takedown requests with hosting providers and registrars</li>
            <li>Implement brand monitoring across social media platforms</li>
            <li>Review and update safe domain allowlists monthly</li>
          </ul>
        </div>
        <Footer reportId={r.reportId} page={7} />
      </div>

      {/* Print styles */}
      <style>{printCSS}</style>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function PageHeader({ title }: { title: string }) {
  return (
    <div style={{ borderBottom: "2px solid #6D40ED", paddingBottom: 8, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>{title}</h2>
      <span style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase" }}>Trust Radar</span>
    </div>
  );
}

function Footer({ reportId, page }: { reportId: string; page: number }) {
  return (
    <div style={styles.footer}>
      <span>Trust Radar by LRX Enterprises Inc. | Confidential</span>
      <span>Report {reportId}</span>
      <span>Page {page}</span>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={styles.metricCard}>
      <div style={{ fontSize: 28, fontWeight: 800, color: color ?? "#fff", lineHeight: 1 }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: SEV_COLORS[severity] ?? "#64748B", display: "inline-block" }} />
      {capitalize(severity)}
    </span>
  );
}

// ─── Inline styles (works in print) ──────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  body: { background: "#0a0910", minHeight: "100vh", fontFamily: "'Inter', sans-serif" },
  loadingPage: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0910" },
  spinner: { width: 40, height: 40, border: "3px solid #1e1b2e", borderTop: "3px solid #6D40ED", borderRadius: "50%", animation: "spin 1s linear infinite" },
  downloadBar: { position: "sticky" as const, top: 0, zIndex: 50, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 32px", background: "#110F12", borderBottom: "1px solid #1e293b" },
  downloadBtn: { padding: "8px 20px", background: "#6D40ED", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  periodSelect: { padding: "8px 12px", background: "#1a1720", color: "#cbd5e1", border: "1px solid #334155", borderRadius: 8, fontSize: 13 },
  page: { maxWidth: 900, margin: "0 auto", padding: "48px 48px 24px", background: "#110F12", position: "relative" as const, minHeight: 1000, display: "flex", flexDirection: "column" },
  coverPage: { flex: 1, display: "flex", flexDirection: "column" },
  coverLogo: { display: "flex", alignItems: "center", padding: "32px 0" },
  tlpBadge: { display: "inline-block", padding: "6px 20px", background: "#8A5900", color: "#fff", borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: "0.15em" },
  scoreRingContainer: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  riskBadge: { padding: "6px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700, color: "#fff", textTransform: "uppercase" as const, letterSpacing: "0.1em" },
  metricsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },
  metricCard: { background: "#1a1720", borderRadius: 10, padding: "16px 20px", border: "1px solid #1e293b" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: "#8B6FF5", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 12 },
  bodyText: { fontSize: 14, lineHeight: 1.7, color: "#cbd5e1" },
  chartCard: { background: "#1a1720", borderRadius: 10, padding: 20, border: "1px solid #1e293b" },
  chartTitle: { fontSize: 13, fontWeight: 600, color: "#cbd5e1", marginBottom: 12 },
  legend: { display: "flex", flexWrap: "wrap" as const, gap: 12, fontSize: 11, color: "#94a3b8" },
  legendItem: { display: "flex", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 12 },
  th: { textAlign: "left" as const, padding: "8px 12px", borderBottom: "2px solid #1e293b", color: "#94a3b8", fontWeight: 600, fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.1em" },
  td: { padding: "8px 12px", borderBottom: "1px solid #1e293b", color: "#cbd5e1", fontSize: 12, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  emptyState: { padding: 32, textAlign: "center" as const, color: "#475569", fontSize: 14 },
  footer: { marginTop: "auto", paddingTop: 16, borderTop: "1px solid #1e293b", display: "flex", justifyContent: "space-between", fontSize: 9, color: "#475569" },
  recCard: { display: "flex", alignItems: "flex-start", gap: 12, background: "#1a1720", border: "1px solid #1e293b", borderRadius: 10, padding: "14px 18px" },
  recNumber: { width: 28, height: 28, borderRadius: "50%", background: "#6D40ED", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 },
};

const printCSS = `
@keyframes spin { to { transform: rotate(360deg); } }

@media print {
  .report-download-bar { display: none !important; }
  .report-page {
    page-break-after: always;
    break-after: page;
    min-height: auto !important;
    padding: 32px 40px 20px !important;
  }
  .report-page:last-of-type {
    page-break-after: avoid;
    break-after: avoid;
  }
  body, html {
    background: white !important;
    color: #1a1a2e !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  @page {
    size: A4;
    margin: 0;
  }
}
`;
