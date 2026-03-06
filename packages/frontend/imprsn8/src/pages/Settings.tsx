import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Search, Plus, Key, Shield, Users, Eye, UserCircle, Check } from "lucide-react";
import { admin, profile as profileApi } from "../lib/api";
import type { User } from "../lib/types";

interface Ctx { user: User; }

// ── Static KB data ──────────────────────────────────────────────────────────
const KB_ARTICLES = [
  { id: "kb1", cat: "Getting Started", icon: "⚡", title: "Onboarding your influencer tenant to imprsn8", views: 2104, updated: "1d ago", tags: ["setup", "tenant"] },
  { id: "kb2", cat: "OCI Detection", icon: "🔬", title: "Understanding Indicators of Impersonation (IOI) — full taxonomy", views: 1891, updated: "3d ago", tags: ["oci", "ioi", "detection"] },
  { id: "kb3", cat: "OCI Detection", icon: "🖼️", title: "OCI Likeness Vault & perceptual fingerprinting explained", views: 1204, updated: "5d ago", tags: ["likeness", "phash", "fingerprint"] },
  { id: "kb4", cat: "Takedowns", icon: "🚩", title: "DMCA Notices vs Platform Trust & Safety Reports", views: 987, updated: "2d ago", tags: ["dmca", "takedown"] },
  { id: "kb5", cat: "Takedowns", icon: "⚖️", title: "Human-in-the-Loop (HITL): mandatory analyst review protocol", views: 876, updated: "4d ago", tags: ["hitl", "analyst", "review"] },
  { id: "kb6", cat: "AI Agents", icon: "🤖", title: "Agent taxonomy: SENTINEL · RECON · VERITAS · NEXUS · ARBITER · WATCHDOG", views: 1432, updated: "1w ago", tags: ["agents", "sentinel", "recon"] },
  { id: "kb7", cat: "AI Agents", icon: "🛡️", title: "WATCHDOG: approved TTP boundaries and compliance enforcement", views: 654, updated: "1w ago", tags: ["watchdog", "compliance", "ttp"] },
  { id: "kb8", cat: "Threat Intel", icon: "🎯", title: "Threat actor profiling and cross-platform attribution chains", views: 743, updated: "6d ago", tags: ["attribution", "nexus", "actor"] },
  { id: "kb9", cat: "Access Mgmt", icon: "🔑", title: "RBAC, MFA enforcement, and module-level access configuration", views: 521, updated: "1w ago", tags: ["rbac", "mfa", "access"] },
  { id: "kb10", cat: "Integrations", icon: "🔗", title: "Connecting social media accounts — API keys and OAuth scopes", views: 1109, updated: "2d ago", tags: ["integration", "social", "api"] },
  { id: "kb11", cat: "OCI Detection", icon: "🧬", title: "VERITAS Vision: multimodal likeness analysis and scoring methodology", views: 833, updated: "4d ago", tags: ["veritas", "similarity", "ai"] },
  { id: "kb12", cat: "Threat Intel", icon: "🕸️", title: "NEXUS Correlator: building and reading attribution graphs", views: 612, updated: "5d ago", tags: ["nexus", "graph", "attribution"] },
];

const ROLE_INFO = [
  { role: "Admin", icon: Key, desc: "Full platform access, admin console, agent management", badge: "text-gold" },
  { role: "SOC Analyst", icon: Shield, desc: "Threat review, OCI vault, takedown authorisation (HITL)", badge: "text-purple-light" },
  { role: "Influencer", icon: Users, desc: "Own tenant dashboard, accounts, alerts, takedown status", badge: "text-blue-400" },
  { role: "Infl. Staff", icon: Eye, desc: "Read-only access to assigned influencer dashboard", badge: "text-status-live" },
];

type TabId = "profile" | "access" | "knowledge";

export default function Settings() {
  const { user } = useOutletContext<Ctx>();
  const [tab, setTab] = useState<TabId>("profile");

  // Access management state
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const isAdmin = user.is_admin === 1 || user.role === "admin";

  // Profile editing state
  const [profileForm, setProfileForm] = useState({
    display_name: user.display_name ?? "",
    username: user.username ?? "",
    bio: user.bio ?? "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError("");
    try {
      await profileApi.update({
        display_name: profileForm.display_name.trim() || undefined,
        username: profileForm.username.trim() || undefined,
        bio: profileForm.bio.trim() || undefined,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setProfileSaving(false);
    }
  }

  // KB state
  const [kbQuery, setKbQuery] = useState("");
  const [kbCat, setKbCat] = useState("All");
  const kbCats = ["All", ...Array.from(new Set(KB_ARTICLES.map((a) => a.cat)))];
  const filteredKb = KB_ARTICLES.filter(
    (a) =>
      (kbCat === "All" || a.cat === kbCat) &&
      (kbQuery === "" ||
        a.title.toLowerCase().includes(kbQuery.toLowerCase()) ||
        a.tags.some((t) => t.includes(kbQuery.toLowerCase())))
  );

  useEffect(() => {
    if (tab === "access" && isAdmin) {
      setLoadingUsers(true);
      admin.users(50, 0).then((res) => {
        setUsers(res.users);
      }).finally(() => setLoadingUsers(false));
    }
  }, [tab, isAdmin]);

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-soc-border pb-1">
        {(["profile", "access", "knowledge"] as TabId[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-all ${
              tab === t
                ? "text-gold border-b-2 border-gold -mb-px"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t === "profile" ? "My Profile" : t === "access" ? "Access Management" : "Knowledge Base"}
          </button>
        ))}
      </div>

      {/* ── My Profile ── */}
      {tab === "profile" && (
        <div className="space-y-4 max-w-lg">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-purple/20 border border-purple/30 flex items-center justify-center text-xl font-bold text-purple-light">
              {(user.display_name ?? user.email)[0]?.toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-slate-200">{user.display_name ?? "—"}</div>
              <div className="text-xs text-slate-500 font-mono">{user.email}</div>
              <div className="text-[10px] text-slate-600 mt-0.5 uppercase tracking-wider">{user.role} · {user.plan}</div>
            </div>
          </div>

          <form onSubmit={handleProfileSave} className="soc-card space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <UserCircle size={14} className="text-gold" />
              <span className="text-sm font-semibold text-slate-200">Edit Profile</span>
            </div>

            {profileError && (
              <div className="text-red-400 text-xs bg-red-950/30 border border-red-900/30 rounded px-3 py-2">{profileError}</div>
            )}

            <div>
              <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Display Name</label>
              <input
                className="soc-input"
                placeholder="Your name"
                value={profileForm.display_name}
                onChange={(e) => setProfileForm((f) => ({ ...f, display_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Username</label>
              <input
                className="soc-input"
                placeholder="@handle"
                value={profileForm.username}
                onChange={(e) => setProfileForm((f) => ({ ...f, username: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Bio</label>
              <textarea
                className="soc-input w-full min-h-[80px] resize-y"
                placeholder="Short bio..."
                value={profileForm.bio}
                onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
              />
            </div>
            <button
              type="submit"
              disabled={profileSaving}
              className={`btn-gold flex items-center gap-2 ${profileSaved ? "!bg-status-live/20 !border-status-live !text-status-live" : ""}`}
            >
              {profileSaved ? <><Check size={13} /> Saved</> : profileSaving ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </div>
      )}

      {/* ── Access Management ── */}
      {tab === "access" && (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-slate-100">Access Management</h1>
              <p className="text-xs text-slate-500 mt-0.5">RBAC · MFA Enforcement · Module-level Permissions</p>
            </div>
            {isAdmin && (
              <button className="btn-gold flex items-center gap-2">
                <Plus size={13} /> Invite User
              </button>
            )}
          </div>

          {/* Role cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {ROLE_INFO.map(({ role, icon: Icon, desc, badge }) => (
              <div key={role} className="soc-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={13} className={badge} />
                  <span className={`text-xs font-bold uppercase ${badge}`}>{role}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* User table — admin only */}
          {isAdmin && (
            <div className="soc-card overflow-hidden">
              <div className="px-5 py-3 border-b border-soc-border flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200">
                  Platform Users {users.length > 0 ? `(${users.length})` : ""}
                </span>
              </div>
              {loadingUsers ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-soc-border">
                        {["User", "Role", "Email", "Plan", "Admin", "Actions"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-soc-border/50 hover:bg-soc-border/10 transition-colors last:border-0">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-purple/20 flex items-center justify-center text-[10px] font-bold text-purple-light">
                                {(u.display_name ?? u.email)[0]?.toUpperCase()}
                              </div>
                              <span className="font-medium text-slate-200">{u.display_name ?? u.email}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold uppercase ${
                              u.role === "admin" ? "text-gold" :
                              u.role === "soc" ? "text-purple-light" :
                              u.role === "influencer" ? "text-blue-400" : "text-status-live"
                            }`}>{u.role}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 font-mono">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className="badge-submitted capitalize">{u.plan}</span>
                          </td>
                          <td className="px-4 py-3">
                            {u.is_admin ? (
                              <span className="badge-high">ADMIN</span>
                            ) : (
                              <span className="badge-dismissed">NO</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5">
                              <button className="btn-ghost !py-1 !px-2 text-xs">Edit</button>
                              <button className="btn-ghost !py-1 !px-2 text-xs text-slate-600">Revoke</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {users.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-sm">No users found</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Current user info (non-admin) */}
          {!isAdmin && (
            <div className="soc-card">
              <div className="text-[10px] font-bold text-slate-500 tracking-widest mb-4">YOUR ACCOUNT</div>
              <div className="space-y-0">
                {[
                  ["Email", user.email],
                  ["Role", user.role],
                  ["Plan", user.plan],
                  ["Display Name", user.display_name ?? "—"],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between py-2.5 border-b border-soc-border text-sm last:border-0">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-medium text-slate-200 capitalize">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Knowledge Base ── */}
      {tab === "knowledge" && (
        <div className="space-y-5">
          <div>
            <h1 className="text-xl font-bold text-slate-100">Knowledge Base</h1>
            <p className="text-xs text-slate-500 mt-0.5">Guides, protocols, and reference documentation</p>
          </div>

          {/* Search + category filter */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                className="soc-input w-full pl-8"
                placeholder="Search articles, tags..."
                value={kbQuery}
                onChange={(e) => setKbQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {kbCats.map((c) => (
                <button
                  key={c}
                  onClick={() => setKbCat(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    kbCat === c
                      ? "border-purple/50 bg-purple/15 text-purple-light"
                      : "border-soc-border text-slate-500 hover:border-soc-border-bright hover:text-slate-300"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Article grid */}
          {filteredKb.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <div className="text-4xl mb-3">🔍</div>
              <div>No articles match your search</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredKb.map((article) => (
                <div
                  key={article.id}
                  className="soc-card cursor-pointer hover:border-soc-border-bright transition-all p-4"
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-xl">{article.icon}</span>
                    <span className="badge-submitted text-[10px]">{article.cat}</span>
                  </div>
                  <div className="font-semibold text-slate-200 text-sm leading-snug mb-2.5">{article.title}</div>
                  <div className="flex gap-1.5 flex-wrap mb-2.5">
                    {article.tags.map((tag) => (
                      <span key={tag} className="badge-dismissed text-[9px]">{tag}</span>
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>{article.views.toLocaleString()} views</span>
                    <span>Updated {article.updated}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
