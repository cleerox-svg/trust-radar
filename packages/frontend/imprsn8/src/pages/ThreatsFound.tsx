import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { RefreshCw, ChevronLeft, Flag, Shield, Copy, X, AlertTriangle, Lock, Plus } from "lucide-react";
import { threats } from "../lib/api";
import { SeverityBadge, ThreatStatusBadge } from "../components/ui/SeverityBadge";
import { PlatformIcon } from "../components/ui/PlatformIcon";
import { Ring } from "../components/ui/Ring";
import { CreateTakedownModal } from "../components/CreateTakedownModal";
import type { ImpersonationReport, InfluencerProfile, User, ThreatSeverity, ThreatStatus } from "../lib/types";

interface Ctx {
  user: User;
  selectedInfluencer: InfluencerProfile | null;
  influencerList: InfluencerProfile[];
  setThreatCount: (n: number) => void;
}

const FILTERS: { label: string; field: "severity" | "status" | "all"; value: string }[] = [
  { label: "ALL", field: "all", value: "all" },
  { label: "CRITICAL", field: "severity", value: "critical" },
  { label: "HIGH", field: "severity", value: "high" },
  { label: "MEDIUM", field: "severity", value: "medium" },
  { label: "PENDING REVIEW", field: "status", value: "new" },
];

function timeAgo(ts: string | null | undefined): string {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-soc-border text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-200">{value}</span>
    </div>
  );
}

function ThreatDetail({
  threat,
  influencerList,
  onBack,
  onUpdate,
}: {
  threat: ImpersonationReport;
  influencerList: InfluencerProfile[];
  onBack: () => void;
  onUpdate: (id: string, data: { status?: ThreatStatus; soc_note?: string }) => Promise<void>;
}) {
  const [note, setNote] = useState(threat.soc_note ?? "");
  const [saving, setSaving] = useState(false);
  const [showTakedown, setShowTakedown] = useState(false);

  async function handleStatusChange(status: ThreatStatus) {
    setSaving(true);
    try {
      await onUpdate(threat.id, { status, soc_note: note });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1.5">
          <ChevronLeft size={14} /> Back
        </button>
        <h1 className="text-xl font-bold text-slate-100">IOI Detail Report</h1>
        <SeverityBadge severity={threat.severity} />
        <ThreatStatusBadge status={threat.status} />
      </div>

      {/* HITL Notice */}
      <div className="soc-card border-threat-critical/30 bg-threat-critical/5 flex gap-3">
        <Lock size={18} className="text-threat-critical shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-bold text-threat-critical mb-1">HITL Active</div>
          <div className="text-xs text-slate-400">
            ARBITER cannot submit takedowns autonomously. Use Takedown Queue to initiate a human-reviewed submission.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Threat account */}
        <div className="soc-card border-threat-critical/20">
          <div className="text-[10px] font-bold text-threat-critical tracking-widest mb-3">⚠ THREAT ACCOUNT</div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-threat-critical/10 border border-threat-critical/30 flex items-center justify-center text-lg font-bold text-white shrink-0">?</div>
            <div>
              <div className="font-bold text-slate-100">@{threat.suspect_handle}</div>
              <div className="text-xs text-threat-critical mt-0.5 capitalize">{threat.threat_type.replace(/_/g, " ")}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-[10px] text-slate-500 uppercase mb-0.5">Platform</div>
              <div className="flex items-center gap-1.5">
                <PlatformIcon platform={threat.platform} size="sm" />
                <span className="text-slate-200 capitalize">{threat.platform}</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase mb-0.5">Followers</div>
              <div className="text-slate-200">{threat.suspect_followers?.toLocaleString() ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase mb-0.5">Detected By</div>
              <div className="text-slate-200 font-mono">{threat.detected_by}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase mb-0.5">Detected</div>
              <div className="text-slate-200">{timeAgo(threat.detected_at)}</div>
            </div>
          </div>
        </div>

        {/* OCI Score */}
        <div className="soc-card flex flex-col items-center justify-center gap-3">
          <div className="text-[10px] font-bold text-slate-500 tracking-widest">OCI SIMILARITY SCORE</div>
          {threat.similarity_score !== null ? (
            <>
              <Ring score={threat.similarity_score} size={96} strokeWidth={8} />
              <div className="text-xs text-slate-400">
                {threat.similarity_score >= 85 ? "High confidence match" : threat.similarity_score >= 70 ? "Likely match" : "Possible match"}
              </div>
            </>
          ) : (
            <div className="text-slate-500 text-sm">No score available</div>
          )}
        </div>
      </div>

      {/* Similarity breakdown */}
      {threat.similarity_breakdown && (
        <div className="soc-card">
          <div className="text-[10px] font-bold text-slate-500 tracking-widest mb-4">SIMILARITY BREAKDOWN</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(threat.similarity_breakdown).map(([key, val]) => (
              <div key={key} className="text-center">
                <div className="text-[10px] text-slate-500 uppercase mb-2">{key.replace(/_/g, " ")}</div>
                <div className="text-2xl font-bold font-mono text-gold">{val}%</div>
                <div className="mt-2 h-1.5 bg-soc-border rounded-full overflow-hidden">
                  <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${val}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI analysis */}
      {threat.ai_analysis && (
        <div className="soc-card">
          <div className="text-[10px] font-bold text-slate-500 tracking-widest mb-3">AI ANALYSIS</div>
          <p className="text-sm text-slate-300 leading-relaxed">{threat.ai_analysis}</p>
        </div>
      )}

      {/* SOC Note + Actions */}
      <div className="soc-card">
        <div className="text-[10px] font-bold text-slate-500 tracking-widest mb-3">ANALYST ASSESSMENT</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add your assessment or findings..."
          className="soc-input w-full min-h-[80px] resize-y mb-4"
        />
        {showTakedown && (
          <CreateTakedownModal
            influencerList={influencerList}
            prefill={{
              influencer_id:  threat.influencer_id,
              platform:       threat.platform,
              suspect_handle: threat.suspect_handle,
              report_id:      threat.id,
            }}
            onCreated={async () => {
              setShowTakedown(false);
              await handleStatusChange("actioning");
            }}
            onClose={() => setShowTakedown(false)}
          />
        )}
        <div className="flex flex-wrap gap-2">
          <button
            disabled={saving}
            onClick={() => setShowTakedown(true)}
            className="btn-gold flex items-center gap-1.5"
          >
            <Flag size={13} /> Initiate Takedown
          </button>
          <button
            disabled={saving}
            onClick={() => handleStatusChange("investigating")}
            className="btn-ghost flex items-center gap-1.5"
          >
            <Shield size={13} /> Mark Investigating
          </button>
          <button
            disabled={saving}
            onClick={() => { navigator.clipboard.writeText(`${threat.suspect_handle} — ${threat.platform} — severity: ${threat.severity}`); }}
            className="btn-ghost flex items-center gap-1.5"
          >
            <Copy size={13} /> Copy Evidence
          </button>
          <button
            disabled={saving}
            onClick={() => handleStatusChange("dismissed")}
            className="btn-ghost flex items-center gap-1.5 text-slate-500"
          >
            <X size={13} /> Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Report Threat Modal ──────────────────────────────────────────────────────
const THREAT_TYPES = [
  { value: "full_clone",       label: "Full Identity Clone" },
  { value: "handle_squat",     label: "Handle Squatting" },
  { value: "bio_copy",         label: "Bio Copy" },
  { value: "avatar_copy",      label: "Avatar Copy" },
  { value: "scam_campaign",    label: "Scam Campaign" },
  { value: "deepfake_media",   label: "Deepfake Media" },
  { value: "unofficial_clips", label: "Unofficial Clips" },
  { value: "voice_clone",      label: "Voice Clone" },
  { value: "other",            label: "Other" },
] as const;

const SEVERITIES = ["critical", "high", "medium", "low"] as const;
const PLATFORMS_LIST = ["tiktok", "instagram", "x", "youtube", "facebook", "linkedin", "twitch", "threads"] as const;

function ReportThreatModal({
  influencerList,
  defaultInfluencerId,
  onCreated,
  onClose,
}: {
  influencerList: InfluencerProfile[];
  defaultInfluencerId?: string;
  onCreated: (t: ImpersonationReport) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    influencer_id:  defaultInfluencerId ?? (influencerList[0]?.id ?? ""),
    platform:       "tiktok",
    suspect_handle: "",
    suspect_url:    "",
    threat_type:    "full_clone" as typeof THREAT_TYPES[number]["value"],
    severity:       "high" as typeof SEVERITIES[number],
    similarity_score: "",
    ai_analysis:    "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.influencer_id || !form.suspect_handle.trim()) { setError("Influencer and handle are required."); return; }
    setSaving(true);
    setError("");
    try {
      const report = await threats.create({
        influencer_id:    form.influencer_id,
        platform:         form.platform as ImpersonationReport["platform"],
        suspect_handle:   form.suspect_handle.trim().replace(/^@/, ""),
        suspect_url:      form.suspect_url.trim() || null,
        threat_type:      form.threat_type,
        severity:         form.severity,
        similarity_score: form.similarity_score ? Number(form.similarity_score) : null,
        ai_analysis:      form.ai_analysis.trim() || null,
        detected_by:      "manual",
        status:           "new",
      });
      onCreated(report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create report");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-soc-card border border-soc-border rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-soc-border sticky top-0 bg-soc-card">
          <div>
            <h2 className="font-bold text-slate-100">Report Impersonation Threat</h2>
            <p className="text-[10px] text-slate-500 mt-0.5 font-mono">Manual IOI — detected_by: analyst</p>
          </div>
          <button onClick={onClose} className="btn-icon !p-1.5"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3.5">
          {error && <div className="text-red-400 text-xs bg-red-950/30 border border-red-900/30 rounded px-3 py-2">{error}</div>}
          <div>
            <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Protected Influencer *</label>
            <select className="soc-select" value={form.influencer_id}
              onChange={(e) => setForm((f) => ({ ...f, influencer_id: e.target.value }))} required>
              <option value="">— select —</option>
              {influencerList.map((inf) => <option key={inf.id} value={inf.id}>{inf.display_name} (@{inf.handle})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Platform *</label>
              <select className="soc-select" value={form.platform}
                onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}>
                {PLATFORMS_LIST.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Suspect Handle *</label>
              <input className="soc-input" placeholder="@handle" value={form.suspect_handle}
                onChange={(e) => setForm((f) => ({ ...f, suspect_handle: e.target.value }))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Threat Type</label>
              <select className="soc-select" value={form.threat_type}
                onChange={(e) => setForm((f) => ({ ...f, threat_type: e.target.value as typeof form.threat_type }))}>
                {THREAT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Severity</label>
              <select className="soc-select" value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as typeof SEVERITIES[number] }))}>
                {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Profile URL</label>
              <input className="soc-input" placeholder="https://..." value={form.suspect_url}
                onChange={(e) => setForm((f) => ({ ...f, suspect_url: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Similarity Score (0–100)</label>
              <input className="soc-input" placeholder="e.g. 87" type="number" min="0" max="100"
                value={form.similarity_score}
                onChange={(e) => setForm((f) => ({ ...f, similarity_score: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Analyst Notes / AI Analysis</label>
            <textarea className="soc-input w-full min-h-[80px] resize-y" placeholder="Describe the threat, evidence found, and how it was detected..."
              value={form.ai_analysis} onChange={(e) => setForm((f) => ({ ...f, ai_analysis: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={saving || !form.influencer_id || !form.suspect_handle.trim()}
              className="btn-gold flex items-center gap-2 flex-1 justify-center">
              <Flag size={13} />
              {saving ? "Reporting…" : "Submit IOI Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ThreatsFound() {
  const { user, selectedInfluencer, influencerList, setThreatCount } = useOutletContext<Ctx>();
  const [list, setList] = useState<ImpersonationReport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterKey, setFilterKey] = useState("all");
  const [selected, setSelected] = useState<ImpersonationReport | null>(null);
  const [showReport, setShowReport] = useState(false);

  const activeFilter = FILTERS.find((f) => `${f.field}:${f.value}` === filterKey) ?? FILTERS[0];

  async function load() {
    setLoading(true);
    try {
      const params: Parameters<typeof threats.list>[0] = {
        influencer_id: selectedInfluencer?.id,
      };
      if (activeFilter.field === "severity") params.severity = activeFilter.value as ThreatSeverity;
      if (activeFilter.field === "status") params.status = activeFilter.value as ThreatStatus;
      const res = await threats.list(params);
      setList(res.data);
      setTotal(res.total);
      setThreatCount(res.data.filter((t) => t.status !== "resolved" && t.status !== "dismissed").length);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [selectedInfluencer, filterKey]);

  async function handleUpdate(id: string, data: { status?: ThreatStatus; soc_note?: string }) {
    const updated = await threats.update(id, data);
    setList((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setSelected(updated);
  }

  if (selected) {
    return (
      <ThreatDetail
        threat={selected}
        influencerList={influencerList}
        onBack={() => setSelected(null)}
        onUpdate={handleUpdate}
      />
    );
  }

  return (
    <>
    {showReport && (
      <ReportThreatModal
        influencerList={influencerList}
        defaultInfluencerId={selectedInfluencer?.id}
        onCreated={(t) => { setList((prev) => [t, ...prev]); setTotal((n) => n + 1); setShowReport(false); }}
        onClose={() => setShowReport(false)}
      />
    )}
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Threat Intelligence</h1>
          <p className="text-xs text-slate-500 mt-0.5">IOI Feed · Actor Registry · Attribution Analysis</p>
        </div>
        <div className="flex gap-2">
          {(user.role === "soc" || user.role === "admin") && (
            <button onClick={() => setShowReport(true)} className="btn-gold flex items-center gap-1.5 !py-1.5 !px-3 !text-xs">
              <Plus size={12} /> Report Threat
            </button>
          )}
          <button onClick={load} disabled={loading} className="btn-icon">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map((f) => {
          const key = `${f.field}:${f.value}`;
          const active = key === filterKey;
          return (
            <button
              key={key}
              onClick={() => setFilterKey(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                active
                  ? "border-purple/50 bg-purple/15 text-purple-light"
                  : "border-soc-border text-slate-500 hover:border-soc-border-bright hover:text-slate-300"
              }`}
            >
              {f.label}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-slate-600 self-center">{total} threats</span>
      </div>

      {/* Threat list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <div className="text-4xl mb-3">🔍</div>
          <div>No threats match this filter</div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {list.map((threat) => (
            <div
              key={threat.id}
              onClick={() => setSelected(threat)}
              className="soc-card flex items-center gap-4 flex-wrap cursor-pointer hover:border-soc-border-bright transition-all"
            >
              {threat.similarity_score !== null && (
                <Ring score={threat.similarity_score} size={52} strokeWidth={5} />
              )}
              <div className="flex-1 min-w-[180px]">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-bold text-slate-100 font-mono">@{threat.suspect_handle}</span>
                  <PlatformIcon platform={threat.platform} size="sm" />
                  <SeverityBadge severity={threat.severity} />
                </div>
                <div className="text-xs text-slate-500">
                  {threat.threat_type.replace(/_/g, " ")} · {timeAgo(threat.detected_at)}
                  {threat.influencer_name && ` · ${threat.influencer_name}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ThreatStatusBadge status={threat.status} />
                {(threat.status === "new" || threat.status === "investigating") && (
                  <AlertTriangle size={14} className="text-threat-critical" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
