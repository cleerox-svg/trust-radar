import { useState } from "react";
import { Card, CardContent } from "../components/ui";

interface Article {
  title: string;
  category: string;
  summary: string;
  tags: string[];
}

const ARTICLES: Article[] = [
  { title: "Understanding Trust Scores", category: "Core Concepts", summary: "Trust scores are calculated from 0-100 based on SSL validity, VirusTotal reputation, domain age, WHOIS data, and behavioural signals.", tags: ["trust", "scoring", "fundamentals"] },
  { title: "Risk Levels Explained", category: "Core Concepts", summary: "Domains are classified as safe (80+), low (60-79), medium (40-59), high (20-39), or critical (<20) based on the aggregated trust score.", tags: ["risk", "classification"] },
  { title: "Signal Sources & Stations", category: "Architecture", summary: "Signals originate from three primary stations: Alpha (web scanner), Beta (API endpoint), Gamma (browser extension), plus cache nodes.", tags: ["signals", "architecture", "stations"] },
  { title: "VirusTotal Integration", category: "Integrations", summary: "Each URL is cross-checked against 70+ antivirus engines via the VirusTotal API. Malicious counts directly reduce the trust score.", tags: ["virustotal", "integration", "antivirus"] },
  { title: "WHOIS & Domain Metadata", category: "Integrations", summary: "Registration date, registrar, and country data are retrieved from WHOIS lookups to flag newly registered or privacy-protected domains.", tags: ["whois", "domain", "metadata"] },
  { title: "Alert Triage Guide", category: "Operations", summary: "Open alerts should be reviewed within 24 hours. Use ACK to acknowledge, then escalate or resolve based on investigation outcome.", tags: ["alerts", "operations", "triage"] },
  { title: "API Authentication", category: "API Reference", summary: "All protected endpoints require a Bearer token in the Authorization header. Tokens are issued at login and expire after 7 days.", tags: ["api", "auth", "jwt"] },
  { title: "Scan Caching", category: "Performance", summary: "Scan results are cached per domain for up to 24 hours to reduce external API calls. Cached results are marked with a cache badge.", tags: ["cache", "performance", "domains"] },
  { title: "Intelligence Feed System", category: "Architecture", summary: "24 feed modules across 3 tiers ingest threat data from OSINT sources, commercial feeds, and community platforms with circuit breaker protection.", tags: ["feeds", "intelligence", "architecture"] },
  { title: "AI Agent Framework", category: "Agents", summary: "10 specialized AI agents handle threat triage, hunting, impersonation detection, takedown orchestration, and executive briefing generation.", tags: ["agents", "ai", "automation"] },
  { title: "HITL Approval Workflow", category: "Agents", summary: "High-impact agent actions like takedown notices and executive briefings require human-in-the-loop approval before execution.", tags: ["hitl", "approval", "agents"] },
  { title: "Investigation Tickets", category: "Operations", summary: "Investigations use LRX-XXXXX ticket IDs with severity, priority, and SLA tracking. Tickets flow through open, investigating, escalated, and closed states.", tags: ["investigations", "tickets", "workflow"] },
];

const CATEGORIES = ["All", ...Array.from(new Set(ARTICLES.map((a) => a.category)))];

export default function KnowledgeBasePage() {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = ARTICLES.filter((a) => {
    const matchCat = category === "All" || a.category === category;
    const q = search.toLowerCase();
    const matchSearch = !q || a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q) || a.tags.some((t) => t.includes(q));
    return matchCat && matchSearch;
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Knowledge Base</h1>
          <p className="text-sm text-[--text-secondary]">Documentation, guides, and reference material</p>
        </div>
        <span className="text-xs font-mono text-[--text-tertiary]">{filtered.length} articles</span>
      </div>

      {/* Search + filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs text-sm px-3 py-2 rounded-lg bg-[--surface-base] border border-[--border-subtle] text-[--text-primary] placeholder:text-[--text-tertiary] focus:border-cyan-500 focus:outline-none"
        />
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                category === c
                  ? "border-cyan-500 bg-cyan-500/15 text-blue-500"
                  : "border-[--border-subtle] text-[--text-tertiary] hover:text-[--text-secondary]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Articles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.length === 0 && (
          <div className="col-span-2">
            <Card>
              <CardContent>
                <div className="text-sm text-[--text-tertiary] py-8 text-center">No articles found</div>
              </CardContent>
            </Card>
          </div>
        )}
        {filtered.map((a) => (
          <Card key={a.title} className="hover:border-[--border-default] transition-colors group">
            <CardContent>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-[--text-primary] group-hover:text-blue-500 transition-colors">{a.title}</h3>
                <span className="text-[10px] font-mono bg-cyan-500/10 text-blue-500 px-1.5 py-0.5 rounded shrink-0">{a.category}</span>
              </div>
              <p className="text-xs text-[--text-tertiary] leading-relaxed">{a.summary}</p>
              <div className="flex flex-wrap gap-1 mt-3">
                {a.tags.map((t) => (
                  <span key={t} className="text-[10px] font-mono bg-[--surface-base] text-[--text-tertiary] rounded px-1.5 py-0.5">#{t}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
