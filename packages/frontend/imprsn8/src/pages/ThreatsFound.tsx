/**
 * Threat Center — spec §Screen 3: Threat Center
 *
 * Two-panel email-client layout:
 *   Left  (360px): threat list + filter pills
 *   Right (flex):  threat detail with step indicator, actions, evidence
 */

import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  RefreshCw, Flag, Shield, Copy, X, AlertTriangle,
  Lock, Plus, Eye, CheckCircle, ChevronRight,
} from "lucide-react";
import { threats, accounts as accountsApi } from "../lib/api";
import { SeverityBadge, ThreatStatusBadge } from "../components/ui/SeverityBadge";
import { PlatformIcon } from "../components/ui/PlatformIcon";
import { ScoreRing } from "../components/ui/ScoreRing";
import { CreateTakedownModal } from "../components/CreateTakedownModal";
import type {
  ImpersonationReport, InfluencerProfile, User,
  ThreatSeverity, ThreatStatus, Platform,
} from "../lib/types";

interface Ctx {
  user: User;
  selectedInfluencer: InfluencerProfile | null;
  influencerList: InfluencerProfile[];
  setThreatCount: (n: number) => void;
}

const FILTERS = [
  { label: "All",      field: "all",      value: "all" },
  { label: "Critical", field: "severity", value: "critical" },
  { label: "High",     field: "severity", value: "high" },
  { label: "Medium",   field: "severity", value: "medium" },
  { label: "Resolved", field: "status",   value: "resolved" },
] as const;

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
const PLATFORMS_LIST = [
  "tiktok", "instagram", "x", "youtube", "facebook",
  "linkedin", "twitch", "threads", "snapchat", "pinterest",
  "bluesky", "reddit", "github", "mastodon",
] as const;

const MONITORABLE: Platform[] = [
  "tiktok","instagram","x","youtube","facebook","linkedin",
  "twitch","threads","snapchat","pinterest","bluesky","reddit","github","mastodon",
];

function timeAgo(ts: string | null | undefined): string {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Threat List Row ──────────────────────────────────────────────────────────
function ThreatRow({
  threat, isActive, onClick,
}: {
  threat: ImpersonationReport;
  isActive: boolean;
  onClick: () => void;
}) {
  const severityDotColor: Record<string, string> = {
    critical: "var(--red-400)",
    high:     "var(--threat-high)",
    medium:   "var(--amber-400)",
    low:      "var(--green-400)",
  };

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 text-left transition-colors"
      style={{
        padding: "12px 16px",
        background: isActive ? "var(--surface-overlay)" : "transparent",
        borderLeft: isActive ? `3px solid ${severityDotColor[threat.severity] ?? "var(--border-default)"}` : "3px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = "var(--surface-raised)";
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        className="status-dot flex-shrink-0"
        style={{ background: severityDotColor[threat.severity] ?? "var(--border-default)" }}
        aria-label={threat.severity}
      />
      <PlatformIcon platform={threat.platform} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-mono font-medium truncate" style={{ color: "var(--text-primary)" }}>
          @{threat.suspect_handle}
        </div>
        <div className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>
          {threat.threat_type.replace(/_/g, " ")}
          {threat.influencer_name && <> · {threat.influencer_name}</>}
        </div>
      </div>
      <span className="text-xs flex-shrink-0 font-mono" style={{ color: "var(--text-tertiary)" }}>
        {timeAgo(threat.detected_at)}
      </span>
      <ChevronRight size={12} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
    </button>
  );
}

// ─── Threat Detail ────────────────────────────────────────────────────────────
function ThreatDetail({
  threat, influencerList, onUpdate,
}: {
  threat: ImpersonationReport;
  influencerList: InfluencerProfile[];
  onUpdate: (id: string, data: { status?: ThreatStatus; soc_note?: string }) => Promise<void>;
}) {
  const [note, setNote] = useState(threat.soc_note ?? "");
  const [saving, setSaving] = useState(false);
  const [showTakedown, setShowTakedown] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const canMonitor = MONITORABLE.includes(threat.platform as Platform);

  // Keep note in sync when selected threat changes
  useEffect(() => { setNote(threat.soc_note ?? ""); setActionMsg(null); }, [threat.id]);

  async function handleStatusChange(status: ThreatStatus) {
    setSaving(true);
    try { await onUpdate(threat.id, { status, soc_note: note }); } finally { setSaving(false); }
  }

  async function handleMonitor() {
    setSaving(true);
    setActionMsg(null);
    try {
      await accountsApi.add({
        influencer_id: threat.influencer_id,
        platform: threat.platform as Platform,
        handle: threat.suspect_handle,
        profile_url: threat.suspect_url ?? undefined,
        follower_count: threat.suspect_followers ?? undefined,
      });
      setActionMsg("Account added to monitoring.");
      await onUpdate(threat.id, { status: "investigating", soc_note: note || undefined });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setActionMsg(msg.toLowerCase().includes("unique") ? "Account already monitored." : "Failed to add account.");
    } finally { setSaving(false); }
  }

  async function handleMarkSafe() {
    setSaving(true);
    setActionMsg(null);
    try {
      const acc = await accountsApi.add({
        influencer_id: threat.influencer_id,
        platform: threat.platform as Platform,
        handle: threat.suspect_handle,
        profile_url: threat.suspect_url ?? undefined,
        follower_count: threat.suspect_followers ?? undefined,
      });
      await accountsApi.update(acc.id, { risk_category: "legitimate", risk_score: 95 });
      setActionMsg("Account marked safe.");
    } catch {
      setActionMsg("Account already exists — updating status.");
    }
    await onUpdate(threat.id, { status: "dismissed", soc_note: note || "Marked safe — confirmed legitimate account." });
    setSaving(false);
  }

  // Detection timeline steps
  const steps = [
    { agent: threat.detected_by, action: "Detected", outcome: `Similarity ${threat.similarity_score ?? "?"}%`, done: true },
    { agent: "ARBITER", action: "Assessment", outcome: `${threat.severity.toUpperCase()} severity`, done: threat.status !== "new" },
    { agent: "SOC", action: "Review", outcome: threat.status === "resolved" || threat.status === "dismissed" ? "Complete" : "Pending", done: threat.status === "actioning" || threat.status === "resolved" || threat.status === "dismissed" },
    { agent: "ARBITER", action: "Takedown", outcome: threat.status === "resolved" ? "Resolved" : "Awaiting", done: threat.status === "resolved" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 animate-fade-in">
      {/* Breadcrumb + header */}
      <div>
        <div className="text-11 uppercase tracking-widest mb-2" style={{ color: "var(--text-tertiary)" }}>
          {threat.platform} / {threat.threat_type.replace(/_/g, " ")} / {threat.id.slice(0, 8)}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-display font-bold text-22" style={{ color: "var(--text-primary)" }}>
            @{threat.suspect_handle}
          </h2>
          <SeverityBadge severity={threat.severity} />
          <ThreatStatusBadge status={threat.status} />
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          disabled={saving}
          onClick={() => setShowTakedown(true)}
          className="btn-gold flex items-center gap-1.5"
        >
          <Flag size={12} /> Initiate Takedown
        </button>
        <button
          disabled={saving}
          onClick={() => handleStatusChange("resolved")}
          className="btn-ghost flex items-center gap-1.5"
        >
          <CheckCircle size={12} /> Resolve
        </button>
        <button
          disabled={saving}
          onClick={() => { void navigator.clipboard.writeText(`@${threat.suspect_handle} — ${threat.platform} — ${threat.severity}`); }}
          className="btn-ghost flex items-center gap-1.5"
        >
          <Copy size={12} /> Copy
        </button>
        <button
          disabled={saving}
          onClick={() => handleStatusChange("dismissed")}
          className="btn-ghost flex items-center gap-1.5"
          style={{ color: "var(--text-tertiary)" }}
        >
          <X size={12} /> Dismiss
        </button>
      </div>

      {/* HITL notice */}
      <div
        className="flex gap-3 p-4 rounded-lg"
        style={{ background: "rgba(232,22,59,0.06)", border: "1px solid rgba(232,22,59,0.2)" }}
      >
        <Lock size={16} style={{ color: "var(--red-400)", flexShrink: 0, marginTop: 2 }} />
        <div>
          <div className="text-xs font-bold mb-0.5" style={{ color: "var(--red-400)" }}>HITL Active</div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            ARBITER cannot submit takedowns autonomously. Use Initiate Takedown above for human-reviewed submission.
          </div>
        </div>
      </div>

      {/* Threat account + score */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="text-11 uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>
            Threat Account
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
              style={{ background: "rgba(232,22,59,0.1)", border: "1px solid rgba(232,22,59,0.3)", color: "var(--red-400)" }}
            >
              ?
            </div>
            <div>
              <div className="font-bold font-mono" style={{ color: "var(--text-primary)" }}>@{threat.suspect_handle}</div>
              <div className="text-xs capitalize mt-0.5" style={{ color: "var(--red-400)" }}>
                {threat.threat_type.replace(/_/g, " ")}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { label: "Platform", value: <span className="flex items-center gap-1"><PlatformIcon platform={threat.platform} size="sm" /><span className="capitalize">{threat.platform}</span></span> },
              { label: "Followers", value: threat.suspect_followers?.toLocaleString() ?? "—" },
              { label: "Detected By", value: <span className="font-mono">{threat.detected_by}</span> },
              { label: "Detected", value: timeAgo(threat.detected_at) },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-11 uppercase mb-1" style={{ color: "var(--text-tertiary)" }}>{label}</div>
                <div style={{ color: "var(--text-primary)" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Similarity ring */}
        <div className="card p-5 flex flex-col items-center justify-center gap-3">
          <div className="text-11 uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
            OCI Similarity Score
          </div>
          {threat.similarity_score !== null ? (
            <>
              <ScoreRing
                score={threat.similarity_score}
                size="card-md"
                label="Similarity"
                showLabel
              />
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {threat.similarity_score >= 85 ? "High confidence match" :
                 threat.similarity_score >= 70 ? "Likely match" : "Possible match"}
              </div>
            </>
          ) : (
            <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>No score available</div>
          )}
        </div>
      </div>

      {/* Detection timeline — horizontal step indicator */}
      <div className="card p-5">
        <div className="text-11 uppercase tracking-widest mb-4" style={{ color: "var(--text-tertiary)" }}>
          Detection Timeline
        </div>
        <div className="flex items-start gap-0">
          {steps.map((step, i) => (
            <div key={i} className="flex-1 flex flex-col items-center text-center min-w-0">
              {/* Step dot + connector */}
              <div className="flex items-center w-full mb-2">
                {i > 0 && (
                  <div
                    className="flex-1 h-px"
                    style={{ background: steps[i - 1].done ? "var(--gold-400)" : "var(--border-subtle)" }}
                  />
                )}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{
                    background: step.done ? "var(--gold-400)" : "var(--surface-overlay)",
                    border: `2px solid ${step.done ? "var(--gold-400)" : "var(--border-default)"}`,
                    color: step.done ? "var(--gold-600)" : "var(--text-tertiary)",
                  }}
                >
                  {step.done ? "✓" : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className="flex-1 h-px"
                    style={{ background: step.done ? "var(--gold-400)" : "var(--border-subtle)" }}
                  />
                )}
              </div>
              <div className="text-[10px] font-bold font-mono mb-0.5" style={{ color: "var(--text-secondary)" }}>
                {step.agent}
              </div>
              <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{step.action}</div>
              <div className="text-[10px] font-medium mt-0.5" style={{ color: step.done ? "var(--gold-400)" : "var(--text-disabled)" }}>
                {step.outcome}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Similarity breakdown */}
      {threat.similarity_breakdown && Object.keys(threat.similarity_breakdown).length > 0 && (
        <div className="card p-5">
          <div className="text-11 uppercase tracking-widest mb-4" style={{ color: "var(--text-tertiary)" }}>
            Similarity Breakdown
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(threat.similarity_breakdown).map(([key, val]) => (
              <div key={key} className="text-center">
                <div className="text-11 uppercase mb-2" style={{ color: "var(--text-tertiary)" }}>
                  {key.replace(/_/g, " ")}
                </div>
                <div className="text-2xl font-bold font-mono tabular" style={{ color: "var(--gold-400)" }}>{val}%</div>
                <div
                  className="mt-2 h-1 rounded-full overflow-hidden"
                  style={{ background: "var(--surface-overlay)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${val}%`, background: "var(--gold-400)", transition: "width 600ms ease" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI analysis */}
      {threat.ai_analysis && (
        <div className="card p-5">
          <div className="text-11 uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>
            AI Analysis
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {threat.ai_analysis}
          </p>
        </div>
      )}

      {/* Analyst note + secondary actions */}
      <div className="card p-5">
        <div className="text-11 uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>
          Analyst Assessment
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add your assessment or findings..."
          className="soc-input w-full min-h-[80px] resize-y mb-4"
        />
        {actionMsg && (
          <div
            className="text-xs rounded px-3 py-2 mb-3"
            style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.2)", color: "var(--green-400)" }}
          >
            {actionMsg}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <button disabled={saving} onClick={() => handleStatusChange("investigating")}
            className="btn-ghost flex items-center gap-1.5 text-sm">
            <Shield size={12} /> Investigating
          </button>
          {canMonitor && (
            <button disabled={saving} onClick={() => void handleMonitor()}
              className="btn-ghost flex items-center gap-1.5 text-sm">
              <Eye size={12} /> Monitor
            </button>
          )}
          {canMonitor && (
            <button disabled={saving} onClick={() => void handleMarkSafe()}
              className="btn-ghost flex items-center gap-1.5 text-sm"
              style={{ color: "var(--green-400)", borderColor: "rgba(22,163,74,0.3)" }}>
              <CheckCircle size={12} /> Mark Safe
            </button>
          )}
        </div>
      </div>

      {/* Takedown modal */}
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
    </div>
  );
}

// ─── Report Threat Modal ──────────────────────────────────────────────────────
function ReportThreatModal({
  influencerList, defaultInfluencerId, onCreated, onClose,
}: {
  influencerList: InfluencerProfile[];
  defaultInfluencerId?: string;
  onCreated: (t: ImpersonationReport) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    influencer_id:    defaultInfluencerId ?? (influencerList[0]?.id ?? ""),
    platform:         "tiktok",
    suspect_handle:   "",
    suspect_url:      "",
    threat_type:      "full_clone" as typeof THREAT_TYPES[number]["value"],
    severity:         "high" as typeof SEVERITIES[number],
    similarity_score: "",
    ai_analysis:      "",
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
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in">
      <div
        className="w-full max-w-lg rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--surface-overlay)", border: "1px solid var(--border-default)" }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 sticky top-0"
          style={{ background: "var(--surface-overlay)", borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div>
            <h2 className="font-display font-bold" style={{ color: "var(--text-primary)" }}>Report Threat</h2>
            <p className="text-11 mt-0.5" style={{ color: "var(--text-tertiary)" }}>Manual IOI — detected_by: analyst</p>
          </div>
          <button onClick={onClose} className="btn-icon !p-1.5"><X size={16} /></button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4 space-y-3.5">
          {error && (
            <div className="text-xs rounded px-3 py-2"
              style={{ background: "rgba(232,22,59,0.08)", border: "1px solid rgba(232,22,59,0.2)", color: "var(--red-400)" }}>
              {error}
            </div>
          )}
          <div>
            <label className="text-11 block mb-1 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              Protected Influencer *
            </label>
            <select className="soc-select" value={form.influencer_id}
              onChange={(e) => setForm((f) => ({ ...f, influencer_id: e.target.value }))} required>
              <option value="">— select —</option>
              {influencerList.map((inf) => <option key={inf.id} value={inf.id}>{inf.display_name} (@{inf.handle})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-11 block mb-1 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Platform *</label>
              <select className="soc-select" value={form.platform}
                onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}>
                {PLATFORMS_LIST.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-11 block mb-1 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Suspect Handle *</label>
              <input className="soc-input" placeholder="@handle" value={form.suspect_handle}
                onChange={(e) => setForm((f) => ({ ...f, suspect_handle: e.target.value }))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-11 block mb-1 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Threat Type</label>
              <select className="soc-select" value={form.threat_type}
                onChange={(e) => setForm((f) => ({ ...f, threat_type: e.target.value as typeof form.threat_type }))}>
                {THREAT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-11 block mb-1 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Severity</label>
              <select className="soc-select" value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as typeof SEVERITIES[number] }))}>
                {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-11 block mb-1 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Profile URL</label>
              <input className="soc-input" placeholder="https://..." value={form.suspect_url}
                onChange={(e) => setForm((f) => ({ ...f, suspect_url: e.target.value }))} />
            </div>
            <div>
              <label className="text-11 block mb-1 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Similarity (0–100)</label>
              <input className="soc-input" placeholder="87" type="number" min="0" max="100"
                value={form.similarity_score}
                onChange={(e) => setForm((f) => ({ ...f, similarity_score: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-11 block mb-1 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Notes / Analysis</label>
            <textarea className="soc-input w-full min-h-[80px] resize-y" value={form.ai_analysis}
              placeholder="Describe the threat and evidence..."
              onChange={(e) => setForm((f) => ({ ...f, ai_analysis: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={saving || !form.influencer_id || !form.suspect_handle.trim()}
              className="btn-gold flex items-center gap-2 flex-1 justify-center">
              <Flag size={12} /> {saving ? "Reporting…" : "Submit IOI"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function ThreatsFound() {
  const { user, selectedInfluencer, influencerList, setThreatCount } = useOutletContext<Ctx>();
  const [list, setList] = useState<ImpersonationReport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterKey, setFilterKey] = useState("all:all");
  const [selected, setSelected] = useState<ImpersonationReport | null>(null);
  const [showReport, setShowReport] = useState(false);

  const activeFilter = FILTERS.find((f) => `${f.field}:${f.value}` === filterKey) ?? FILTERS[0];

  async function load() {
    setLoading(true);
    try {
      const params: Parameters<typeof threats.list>[0] = { influencer_id: selectedInfluencer?.id };
      if (activeFilter.field === "severity") params.severity = activeFilter.value as ThreatSeverity;
      if (activeFilter.field === "status") params.status = activeFilter.value as ThreatStatus;
      const res = await threats.list(params);
      setList(res.data);
      setTotal(res.total);
      setThreatCount(res.data.filter((t) => t.status !== "resolved" && t.status !== "dismissed").length);
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [selectedInfluencer, filterKey]);

  async function handleUpdate(id: string, data: { status?: ThreatStatus; soc_note?: string }) {
    const updated = await threats.update(id, data);
    setList((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setSelected(updated);
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

      {/* Two-panel email-client layout — stacks vertically on mobile */}
      <div className="flex h-full overflow-hidden" style={{ background: "var(--surface-base)" }}>

        {/* ── Left panel: threat list ─────────────────────────── */}
        {/* Mobile: full screen when no threat selected; Desktop: fixed 360px sidebar */}
        <div
          className={`flex flex-col overflow-hidden flex-shrink-0 ${selected ? "hidden lg:flex" : "flex-1 lg:flex-none"}`}
          style={{
            borderRight: "1px solid var(--border-subtle)",
            background: "var(--surface-raised)",
          }}
        >
          {/* Desktop: constrain to 360px */}
          <div className="flex flex-col flex-1 overflow-hidden lg:w-[360px]">
          {/* List header */}
          <div className="px-4 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-3">
              <h1 className="font-display font-bold text-base" style={{ color: "var(--text-primary)" }}>
                Threat Center
              </h1>
              <div className="flex items-center gap-1.5">
                {(user.role === "soc" || user.role === "admin") && (
                  <button onClick={() => setShowReport(true)} className="btn-icon !p-1">
                    <Plus size={12} />
                  </button>
                )}
                <button onClick={() => void load()} disabled={loading} className="btn-icon !p-1">
                  <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>
            {/* Filter pills */}
            <div className="flex gap-1 flex-wrap">
              {FILTERS.map((f) => {
                const key = `${f.field}:${f.value}`;
                return (
                  <button
                    key={key}
                    onClick={() => setFilterKey(key)}
                    className="filter-pill text-11"
                    style={{
                      background: filterKey === key ? "var(--surface-overlay)" : "",
                      borderColor: filterKey === key ? "var(--border-strong)" : "",
                      color: filterKey === key ? "var(--text-primary)" : "",
                      padding: "3px 10px",
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <div className="text-11 mt-2" style={{ color: "var(--text-tertiary)" }}>
              {total} threat{total !== 1 ? "s" : ""} · Newest first
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 rounded-full animate-spin"
                  style={{ border: "2px solid var(--border-default)", borderTopColor: "var(--gold-400)" }} />
              </div>
            ) : list.length === 0 ? (
              <div className="text-center py-16 text-sm" style={{ color: "var(--text-tertiary)" }}>
                No threats match this filter.
              </div>
            ) : (
              list.map((threat) => (
                <ThreatRow
                  key={threat.id}
                  threat={threat}
                  isActive={selected?.id === threat.id}
                  onClick={() => setSelected(threat)}
                />
              ))
            )}
          </div>
          </div>
        </div>

        {/* ── Right panel: detail ─────────────────────────────── */}
        {/* Mobile: full screen when a threat is selected */}
        <div className={`flex-1 overflow-hidden flex flex-col ${!selected ? "hidden lg:flex" : "flex"}`}>
          {selected ? (
            <>
              {/* Mobile back button */}
              <button
                onClick={() => setSelected(null)}
                className="lg:hidden flex items-center gap-2 px-4 py-3 text-sm"
                style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
              >
                <ChevronRight size={14} className="rotate-180" />
                Back to list
              </button>
              <ThreatDetail
                threat={selected}
                influencerList={influencerList}
                onUpdate={handleUpdate}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              {/* Editorial empty state */}
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
                <path d="M40 8 L68 22 L68 52 C68 62 54 72 40 76 C26 72 12 62 12 52 L12 22 Z"
                  fill="rgba(240,165,0,0.06)" stroke="var(--gold-400)" strokeWidth="1.5" />
                <ellipse cx="32" cy="36" rx="8" ry="6" stroke="var(--gold-400)" strokeWidth="1.5" fill="none" />
                <ellipse cx="48" cy="36" rx="8" ry="6" stroke="var(--gold-400)" strokeWidth="1" strokeOpacity="0.5" fill="none" />
              </svg>
              <div className="text-center">
                <div className="font-display font-semibold text-base mb-1" style={{ color: "var(--text-primary)" }}>
                  Select a threat to investigate.
                </div>
                <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                  {total} threat{total !== 1 ? "s" : ""} in queue.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
