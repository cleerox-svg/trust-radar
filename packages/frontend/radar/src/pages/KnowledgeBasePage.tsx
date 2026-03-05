import { useState } from "react";

interface Article {
  title: string;
  category: string;
  summary: string;
  tags: string[];
}

const ARTICLES: Article[] = [
  {
    title: "Understanding Trust Scores",
    category: "Core Concepts",
    summary: "Trust scores are calculated from 0–100 based on SSL validity, VirusTotal reputation, domain age, WHOIS data, and behavioural signals.",
    tags: ["trust", "scoring", "fundamentals"],
  },
  {
    title: "Risk Levels Explained",
    category: "Core Concepts",
    summary: "Domains are classified as safe (80+), low (60–79), medium (40–59), high (20–39), or critical (<20) based on the aggregated trust score.",
    tags: ["risk", "classification"],
  },
  {
    title: "Signal Sources & Stations",
    category: "Architecture",
    summary: "Signals originate from three primary stations: Alpha (web scanner), Beta (API endpoint), Gamma (browser extension), plus cache nodes.",
    tags: ["signals", "architecture", "stations"],
  },
  {
    title: "VirusTotal Integration",
    category: "Integrations",
    summary: "Each URL is cross-checked against 70+ antivirus engines via the VirusTotal API. Malicious counts directly reduce the trust score.",
    tags: ["virustotal", "integration", "antivirus"],
  },
  {
    title: "WHOIS & Domain Metadata",
    category: "Integrations",
    summary: "Registration date, registrar, and country data are retrieved from WHOIS lookups to flag newly registered or privacy-protected domains.",
    tags: ["whois", "domain", "metadata"],
  },
  {
    title: "Alert Triage Guide",
    category: "Operations",
    summary: "Open alerts should be reviewed within 24 hours. Use ACK to acknowledge, then escalate or resolve based on investigation outcome.",
    tags: ["alerts", "operations", "triage"],
  },
  {
    title: "API Authentication",
    category: "API Reference",
    summary: "All protected endpoints require a Bearer token in the Authorization header. Tokens are issued at login and expire after 7 days.",
    tags: ["api", "auth", "jwt"],
  },
  {
    title: "Scan Caching",
    category: "Performance",
    summary: "Scan results are cached per domain for up to 24 hours to reduce external API calls. Cached results are marked with a cache badge.",
    tags: ["cache", "performance", "domains"],
  },
];

const CATEGORIES = ["All", ...Array.from(new Set(ARTICLES.map((a) => a.category)))];

export default function KnowledgeBasePage() {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = ARTICLES.filter((a) => {
    const matchCat = category === "All" || a.category === category;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      a.title.toLowerCase().includes(q) ||
      a.summary.toLowerCase().includes(q) ||
      a.tags.some((t) => t.includes(q));
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-radar-text">Knowledge Base</h1>
          <p className="text-xs text-radar-muted mt-0.5">Documentation, guides, and reference material</p>
        </div>
        <div className="text-xs font-mono text-radar-muted">{filtered.length} articles</div>
      </div>

      {/* Search + filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          className="input max-w-xs"
          placeholder="Search articles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`text-xs font-mono px-2.5 py-1.5 rounded-lg border transition-colors ${
                category === c
                  ? "bg-radar-cyan/10 border-radar-cyan text-radar-cyan"
                  : "border-radar-border text-radar-muted hover:text-radar-text"
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
          <div className="col-span-2 card text-center text-radar-muted text-sm py-10">
            No articles found
          </div>
        )}
        {filtered.map((a) => (
          <div key={a.title} className="card hover:border-radar-border-2 transition-colors group cursor-default">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="text-sm font-semibold text-radar-text group-hover:text-radar-cyan transition-colors">
                {a.title}
              </div>
              <span className="text-[10px] font-mono bg-radar-cyan/10 text-radar-cyan px-1.5 py-0.5 rounded shrink-0">
                {a.category}
              </span>
            </div>
            <p className="text-xs text-radar-muted leading-relaxed">{a.summary}</p>
            <div className="flex flex-wrap gap-1 mt-3">
              {a.tags.map((t) => (
                <span key={t} className="text-[10px] font-mono bg-radar-border text-radar-muted rounded px-1.5 py-0.5">
                  #{t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
