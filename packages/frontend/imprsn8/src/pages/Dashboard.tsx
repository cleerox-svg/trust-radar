import { useState, useEffect, type FormEvent } from "react";
import { auth, analyses, socials, type User, type Analysis, type SocialProfile } from "../lib/api";

const PLATFORMS = ["linkedin", "twitter", "github", "instagram", "tiktok", "youtube", "website"] as const;
const PLATFORM_ICONS: Record<string, string> = {
  linkedin: "in", twitter: "𝕏", github: "⌥", instagram: "ig",
  tiktok: "tt", youtube: "▶", website: "🌐",
};

function ScoreCard({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg className="-rotate-90" width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#1e1b4b" strokeWidth="7" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="text-center -mt-1">
        <div className="font-bold text-lg" style={{ color }}>{score}</div>
        <div className="text-xs text-brand-muted capitalize">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<Analysis[]>([]);
  const [userSocials, setUserSocials] = useState<SocialProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Analyze form
  const [analyzeType, setAnalyzeType] = useState<Analysis["type"]>("bio");
  const [analyzeInput, setAnalyzeInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [latestAnalysis, setLatestAnalysis] = useState<Analysis | null>(null);

  // Social form
  const [socialPlatform, setSocialPlatform] = useState("linkedin");
  const [socialHandle, setSocialHandle] = useState("");
  const [addingSocial, setAddingSocial] = useState(false);

  useEffect(() => {
    Promise.all([auth.me(), analyses.list(), socials.list()])
      .then(([u, a, s]) => {
        setUser(u);
        setRecentAnalyses(a.slice(0, 5));
        setUserSocials(s);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleAnalyze(e: FormEvent) {
    e.preventDefault();
    if (!analyzeInput.trim()) return;
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      const result = await analyses.start(analyzeType, analyzeInput.trim());
      setLatestAnalysis(result);
      setRecentAnalyses((prev) => [result, ...prev].slice(0, 5));
      setUser((u) => u ? { ...u, impression_score: result.score, total_analyses: u.total_analyses + 1 } : u);
      setAnalyzeInput("");
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleAddSocial(e: FormEvent) {
    e.preventDefault();
    if (!socialHandle.trim()) return;
    setAddingSocial(true);
    try {
      const s = await socials.add(socialPlatform, socialHandle.trim());
      setUserSocials((prev) => [...prev, s]);
      setSocialHandle("");
    } finally {
      setAddingSocial(false);
    }
  }

  async function handleRemoveSocial(platform: string) {
    await socials.remove(platform);
    setUserSocials((prev) => prev.filter((s) => s.platform !== platform));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const overallScore = user?.impression_score ?? 0;
  const scoreColor = overallScore >= 70 ? "#8b5cf6" : overallScore >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            {user?.display_name ?? user?.email?.split("@")[0] ?? "Dashboard"}
          </h1>
          <p className="text-brand-muted text-sm mt-0.5">{user?.plan} plan · {user?.total_analyses} analyses</p>
        </div>
        <div className="text-right">
          <div className="text-5xl font-extrabold gradient-text">{overallScore}</div>
          <div className="text-xs text-brand-muted uppercase tracking-widest">Impression Score</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Analyze + history */}
        <div className="lg:col-span-2 space-y-6">
          {/* Analyze */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-slate-200">New Analysis</h2>
            <form onSubmit={handleAnalyze} className="space-y-3">
              <div className="flex gap-3">
                <select
                  className="input"
                  value={analyzeType}
                  onChange={(e) => setAnalyzeType(e.target.value as Analysis["type"])}
                >
                  <option value="bio">Bio</option>
                  <option value="content">Content</option>
                  <option value="profile">Profile URL</option>
                  <option value="portfolio">Portfolio</option>
                </select>
              </div>
              <textarea
                className="input resize-none"
                rows={4}
                placeholder={analyzeType === "profile" ? "https://linkedin.com/in/yourprofile" : "Paste your bio or content here…"}
                value={analyzeInput}
                onChange={(e) => setAnalyzeInput(e.target.value)}
                disabled={analyzing}
              />
              {analyzeError && <p className="text-red-400 text-sm">{analyzeError}</p>}
              <button type="submit" className="btn-primary" disabled={analyzing || !analyzeInput.trim()}>
                {analyzing ? "Analyzing…" : "Analyze →"}
              </button>
            </form>
          </div>

          {/* Latest analysis result */}
          {latestAnalysis && (
            <div className="card space-y-5 border-brand-purple/30">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-200">Latest Result</h2>
                <span className="text-3xl font-extrabold gradient-text">{latestAnalysis.score}</span>
              </div>
              <div className="flex gap-6 justify-center">
                {Object.entries(latestAnalysis.breakdown).map(([key, val]) => (
                  <ScoreCard key={key} score={val} label={key} color={scoreColor} />
                ))}
              </div>
              {latestAnalysis.strengths.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs text-brand-muted uppercase tracking-wider">Strengths</div>
                  {latestAnalysis.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-brand-purple mt-0.5">✓</span> {s}
                    </div>
                  ))}
                </div>
              )}
              {latestAnalysis.suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs text-brand-muted uppercase tracking-wider">Suggestions</div>
                  {latestAnalysis.suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-brand-pink mt-0.5">→</span> {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recent history */}
          {recentAnalyses.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-brand-border">
                <h2 className="font-semibold text-slate-200">Recent Analyses</h2>
              </div>
              <table className="w-full">
                <tbody>
                  {recentAnalyses.map((a) => (
                    <tr key={a.id} className="border-b border-brand-border last:border-0 hover:bg-brand-border/20 transition-colors">
                      <td className="px-5 py-3">
                        <span className="text-xs bg-brand-purple/20 text-brand-purple px-2 py-0.5 rounded-full capitalize">
                          {a.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-bold text-xl gradient-text">{a.score}</td>
                      <td className="px-5 py-3 text-sm text-brand-muted">
                        {new Date(a.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column: Social profiles */}
        <div className="space-y-6">
          <div className="card space-y-4">
            <h2 className="font-semibold text-slate-200">Social Profiles</h2>

            {userSocials.length > 0 && (
              <div className="space-y-2">
                {userSocials.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-brand-border last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-brand-purple/20 flex items-center justify-center text-xs font-bold text-brand-purple">
                        {PLATFORM_ICONS[s.platform] ?? s.platform[0].toUpperCase()}
                      </span>
                      <div>
                        <div className="text-sm text-slate-200 font-medium capitalize">{s.platform}</div>
                        <div className="text-xs text-brand-muted">@{s.handle}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveSocial(s.platform)}
                      className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
                    >
                      remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddSocial} className="space-y-3">
              <select className="input text-sm" value={socialPlatform} onChange={(e) => setSocialPlatform(e.target.value)}>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <input
                className="input text-sm"
                placeholder="@handle or URL"
                value={socialHandle}
                onChange={(e) => setSocialHandle(e.target.value)}
                disabled={addingSocial}
              />
              <button type="submit" className="btn-ghost w-full text-sm py-2" disabled={addingSocial || !socialHandle.trim()}>
                {addingSocial ? "Adding…" : "+ Add profile"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
