/**
 * Brand Score / Personal Dashboard — spec §G-08
 * Updated to IMPRSN8_DESIGN_SPEC_V2 token system.
 *
 * Hero: ScoreRing hero-lg with 900ms arc animation
 * Sub-scores: ScoreRing card-md (replaces old hand-drawn SVG rings)
 * Colors: V2 CSS variables throughout (no hardcoded #hex or brand-* tokens)
 */

import { useState, useEffect, type FormEvent } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  auth, analyses, socials,
  campaigns as campaignsApi, profile as profileApi,
  type User, type Analysis, type SocialProfile, type ScorePoint, type Campaign,
} from "../lib/api";
import { ScoreRing } from "../components/ui/ScoreRing";

const PLATFORMS = ["linkedin", "twitter", "github", "instagram", "tiktok", "youtube", "website"] as const;
const PLATFORM_ICONS: Record<string, string> = {
  linkedin: "in", twitter: "𝕏", github: "⌥", instagram: "ig",
  tiktok: "tt", youtube: "▶", website: "🌐",
};

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<Analysis[]>([]);
  const [userSocials, setUserSocials] = useState<SocialProfile[]>([]);
  const [scoreHistory, setScoreHistory] = useState<ScorePoint[]>([]);
  const [loading, setLoading] = useState(true);

  const [analyzeType, setAnalyzeType] = useState<Analysis["type"]>("bio");
  const [analyzeInput, setAnalyzeInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [latestAnalysis, setLatestAnalysis] = useState<Analysis | null>(null);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ display_name: "", bio: "", username: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [socialPlatform, setSocialPlatform] = useState("linkedin");
  const [socialHandle, setSocialHandle] = useState("");
  const [addingSocial, setAddingSocial] = useState(false);

  const [userCampaigns, setUserCampaigns] = useState<Campaign[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [campaignChannel, setCampaignChannel] = useState("web");
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  useEffect(() => {
    Promise.all([
      auth.me(),
      analyses.list(),
      socials.list(),
      analyses.scoreHistory(),
      campaignsApi.list(),
    ])
      .then(([u, a, s, h, c]) => {
        setUser(u);
        setRecentAnalyses(a.slice(0, 5));
        setUserSocials(s);
        setScoreHistory(h);
        setUserCampaigns(c);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleCreateCampaign(e: FormEvent) {
    e.preventDefault();
    if (!campaignName.trim()) return;
    setCreatingCampaign(true);
    try {
      const c = await campaignsApi.create(campaignName.trim(), campaignChannel);
      setUserCampaigns((prev) => [c, ...prev]);
      setCampaignName("");
    } finally {
      setCreatingCampaign(false);
    }
  }

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

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError("");
    try {
      const updated = await profileApi.update({
        display_name: profileForm.display_name || undefined,
        bio: profileForm.bio || undefined,
        username: profileForm.username || undefined,
      });
      setUser((u) => u ? { ...u, ...updated } : u);
      setEditingProfile(false);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingProfile(false);
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
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--violet-400)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  const overallScore = user?.impression_score ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      {/* ── Page header: name + score hero ────────────────────── */}
      <div className="flex items-center justify-between gap-6 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {user?.display_name ?? user?.email?.split("@")[0] ?? "Dashboard"}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {user?.plan} plan · {user?.total_analyses} analyses run
          </p>
        </div>
        {/* ScoreRing hero — 900ms arc animation on mount, counter ticks */}
        <ScoreRing
          score={overallScore}
          size="hero-lg"
          label="Impression Score"
          showLabel
          showHealth
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column: analyze + history ─────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Analyze */}
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>New Analysis</h2>
            <form onSubmit={handleAnalyze} className="space-y-3">
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
              <textarea
                className="input resize-none"
                rows={4}
                placeholder={analyzeType === "profile" ? "https://linkedin.com/in/yourprofile" : "Paste your bio or content here…"}
                value={analyzeInput}
                onChange={(e) => setAnalyzeInput(e.target.value)}
                disabled={analyzing}
              />
              {analyzeError && (
                <p className="text-sm" style={{ color: "var(--red-400)" }}>{analyzeError}</p>
              )}
              <button type="submit" className="btn-primary" disabled={analyzing || !analyzeInput.trim()}>
                {analyzing ? "Analyzing…" : "Analyze →"}
              </button>
            </form>
          </div>

          {/* Latest analysis result */}
          {latestAnalysis && (
            <div className="card p-6 space-y-5" style={{ borderColor: "rgba(109,64,237,0.3)" }}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Latest Result</h2>
                {/* Score as large tabular number, gold */}
                <span
                  className="font-display font-bold tabular"
                  style={{ fontSize: 32, color: "var(--gold-400)", fontVariantNumeric: "tabular-nums" }}
                >
                  {latestAnalysis.score}
                </span>
              </div>

              {/* Sub-score breakdown — ScoreRing card-md per dimension */}
              {Object.keys(latestAnalysis.breakdown).length > 0 && (
                <div className="flex gap-5 justify-center flex-wrap py-2">
                  {Object.entries(latestAnalysis.breakdown).map(([key, val]) => (
                    <ScoreRing key={key} score={val} size="card-md" label={key} showLabel />
                  ))}
                </div>
              )}

              {latestAnalysis.strengths.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-11 uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                    Strengths
                  </div>
                  {latestAnalysis.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--green-400)", marginTop: 2 }}>✓</span> {s}
                    </div>
                  ))}
                </div>
              )}

              {latestAnalysis.suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-11 uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                    Suggestions
                  </div>
                  {latestAnalysis.suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--gold-400)", marginTop: 2 }}>→</span> {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Score trend chart */}
          {scoreHistory.length > 0 && (
            <div className="card p-6 space-y-4">
              <div>
                <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  Impression Score Trend
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                  Historical score over time
                </p>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={scoreHistory} margin={{ top: 5, right: 0, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      {/* V2 violet-400 = #6D40ED */}
                      <stop offset="5%"  stopColor="#6D40ED" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6D40ED" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  {/* No grid lines per V2 spec — Stripe/Mercury principle */}
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(242,238,248,0.06)" />
                  <XAxis dataKey="date" tick={{ fill: "#6B5F82", fontSize: 10 }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#6B5F82", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-overlay)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "10px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "#6B5F82" }}
                    itemStyle={{ color: "#6D40ED" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    name="score"
                    stroke="#6D40ED"
                    strokeWidth={2}
                    fill="url(#scoreGrad)"
                    dot={{ fill: "#6D40ED", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent analyses table */}
          {recentAnalyses.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Recent Analyses</h2>
              </div>
              <table className="w-full">
                <tbody>
                  {recentAnalyses.map((a) => (
                    <tr
                      key={a.id}
                      className="transition-colors"
                      style={{ borderBottom: "1px solid var(--border-subtle)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-overlay)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td className="px-5 py-3">
                        <span
                          className="text-11 uppercase px-2 py-0.5 rounded-full"
                          style={{
                            background: "rgba(109,64,237,0.15)",
                            color: "var(--violet-300)",
                          }}
                        >
                          {a.type}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="font-display font-bold tabular"
                          style={{ fontSize: 20, color: "var(--gold-400)", fontVariantNumeric: "tabular-nums" }}
                        >
                          {a.score}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm" style={{ color: "var(--text-tertiary)" }}>
                        {new Date(a.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Right column: profile, socials, campaigns ──────── */}
        <div className="space-y-6">
          {/* Profile card */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Profile</h2>
              {!editingProfile && (
                <button
                  onClick={() => {
                    setProfileForm({
                      display_name: user?.display_name ?? "",
                      bio: user?.bio ?? "",
                      username: user?.username ?? "",
                    });
                    setEditingProfile(true);
                  }}
                  className="text-xs transition-colors"
                  style={{ color: "var(--text-tertiary)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--gold-400)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
                >
                  Edit
                </button>
              )}
            </div>

            {!editingProfile ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                    style={{
                      background: "rgba(109,64,237,0.15)",
                      border: "1px solid var(--border-default)",
                      color: "var(--violet-400)",
                    }}
                  >
                    {(user?.display_name ?? user?.email ?? "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {user?.display_name ?? user?.username ?? user?.email?.split("@")[0]}
                    </div>
                    {user?.username && (
                      <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                        @{user.username}
                      </div>
                    )}
                  </div>
                </div>
                {user?.bio ? (
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {user.bio}
                  </p>
                ) : (
                  <p className="text-xs italic" style={{ color: "var(--text-tertiary)" }}>
                    No bio yet
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-3">
                <div>
                  <label className="text-11 block mb-1 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                    Display name
                  </label>
                  <input
                    className="input text-sm"
                    value={profileForm.display_name}
                    onChange={(e) => setProfileForm((p) => ({ ...p, display_name: e.target.value }))}
                    placeholder="Your name"
                    maxLength={64}
                  />
                </div>
                <div>
                  <label className="text-11 block mb-1 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                    Username
                  </label>
                  <input
                    className="input text-sm"
                    value={profileForm.username}
                    onChange={(e) => setProfileForm((p) => ({ ...p, username: e.target.value }))}
                    placeholder="handle"
                    pattern="[a-zA-Z0-9_-]+"
                    maxLength={32}
                  />
                </div>
                <div>
                  <label className="text-11 block mb-1 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                    Bio
                  </label>
                  <textarea
                    className="input text-sm resize-none"
                    rows={3}
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))}
                    placeholder="A short bio…"
                    maxLength={500}
                  />
                </div>
                {profileError && (
                  <p className="text-xs" style={{ color: "var(--red-400)" }}>{profileError}</p>
                )}
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary text-sm !px-4 !py-2" disabled={savingProfile}>
                    {savingProfile ? "Saving…" : "Save"}
                  </button>
                  <button type="button" className="btn-ghost text-sm !px-4 !py-2" onClick={() => setEditingProfile(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Social Profiles */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Social Profiles</h2>

            {userSocials.length > 0 && (
              <div className="space-y-1">
                {userSocials.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-2"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{ background: "rgba(109,64,237,0.15)", color: "var(--violet-400)" }}
                      >
                        {PLATFORM_ICONS[s.platform] ?? s.platform[0].toUpperCase()}
                      </span>
                      <div>
                        <div className="text-sm font-medium capitalize" style={{ color: "var(--text-primary)" }}>
                          {s.platform}
                        </div>
                        <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>@{s.handle}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveSocial(s.platform)}
                      className="text-xs transition-colors"
                      style={{ color: "rgba(232,22,59,0.5)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red-400)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(232,22,59,0.5)")}
                    >
                      remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddSocial} className="space-y-3">
              <select className="input text-sm" value={socialPlatform} onChange={(e) => setSocialPlatform(e.target.value)}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input
                className="input text-sm"
                placeholder="@handle or URL"
                value={socialHandle}
                onChange={(e) => setSocialHandle(e.target.value)}
                disabled={addingSocial}
              />
              <button
                type="submit"
                className="btn-ghost w-full text-sm py-2"
                disabled={addingSocial || !socialHandle.trim()}
              >
                {addingSocial ? "Adding…" : "+ Add profile"}
              </button>
            </form>
          </div>

          {/* Campaigns */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Campaigns</h2>

            {userCampaigns.length > 0 && (
              <div className="space-y-1">
                {userCampaigns.slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-2"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}
                  >
                    <div>
                      <div
                        className="text-sm font-medium truncate max-w-[120px]"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {c.name}
                      </div>
                      <div className="text-xs capitalize" style={{ color: "var(--text-tertiary)" }}>
                        {c.channel} · {c.status}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="text-xs font-mono tabular"
                        style={{ color: "var(--violet-400)", fontVariantNumeric: "tabular-nums" }}
                      >
                        {c.impressions.toLocaleString()}
                      </div>
                      <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>impressions</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleCreateCampaign} className="space-y-3">
              <input
                className="input text-sm"
                placeholder="Campaign name"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                disabled={creatingCampaign}
              />
              <select
                className="input text-sm"
                value={campaignChannel}
                onChange={(e) => setCampaignChannel(e.target.value)}
              >
                {["web", "mobile", "email", "api"].map((ch) => <option key={ch} value={ch}>{ch}</option>)}
              </select>
              <button
                type="submit"
                className="btn-ghost w-full text-sm py-2"
                disabled={creatingCampaign || !campaignName.trim()}
              >
                {creatingCampaign ? "Creating…" : "+ New campaign"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
