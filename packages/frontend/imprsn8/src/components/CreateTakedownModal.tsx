import { useState } from "react";
import { X, Flag, Lock } from "lucide-react";
import { takedowns } from "../lib/api";
import type { InfluencerProfile, TakedownRequest, TakedownType, Platform } from "../lib/types";

const TAKEDOWN_TYPES: { value: TakedownType; label: string }[] = [
  { value: "dmca",          label: "DMCA — Copyright Violation" },
  { value: "impersonation", label: "Impersonation Report" },
  { value: "trademark",     label: "Trademark Violation" },
  { value: "platform_tos",  label: "Platform ToS Violation" },
  { value: "court_order",   label: "Court Order" },
];

const PLATFORMS: Platform[] = ["tiktok", "instagram", "x", "youtube", "facebook", "linkedin", "twitch", "threads", "snapchat", "pinterest"];

interface Props {
  influencerList: InfluencerProfile[];
  /** Pre-populate fields when launched from a threat card */
  prefill?: {
    influencer_id?: string;
    platform?: string;
    suspect_handle?: string;
    report_id?: string;
  };
  onCreated: (td: TakedownRequest) => void;
  onClose: () => void;
}

export function CreateTakedownModal({ influencerList, prefill, onCreated, onClose }: Props) {
  const [form, setForm] = useState({
    influencer_id:  prefill?.influencer_id  ?? (influencerList.length === 1 ? influencerList[0].id : ""),
    platform:       prefill?.platform       ?? "tiktok",
    suspect_handle: prefill?.suspect_handle ?? "",
    takedown_type:  "impersonation" as TakedownType,
    report_id:      prefill?.report_id      ?? "",
    notes:          "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isPrefilled = Boolean(prefill?.suspect_handle);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.influencer_id || !form.suspect_handle.trim()) {
      setError("Influencer and suspect handle are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const td = await takedowns.create({
        influencer_id:  form.influencer_id,
        platform:       form.platform,
        suspect_handle: form.suspect_handle.trim().replace(/^@/, ""),
        takedown_type:  form.takedown_type,
        report_id:      form.report_id || undefined,
        evidence_json:  form.notes.trim() ? [{ type: "other", description: form.notes.trim() }] : [],
      });
      onCreated(td);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create takedown");
    } finally {
      setSaving(false);
    }
  }

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-soc-card border border-soc-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-soc-border">
          <div>
            <h2 className="font-bold text-slate-100">New Takedown Request</h2>
            <p className="text-[10px] text-slate-500 mt-0.5 font-mono">DRAFT — requires SOC authorisation before submission</p>
          </div>
          <button onClick={onClose} className="btn-icon !p-1.5"><X size={16} /></button>
        </div>

        {/* HITL notice */}
        <div className="mx-5 mt-4 flex gap-2.5 bg-threat-critical/5 border border-threat-critical/20 rounded-lg px-3 py-2.5">
          <Lock size={14} className="text-threat-critical shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            This creates a <strong className="text-slate-300">DRAFT</strong>. A SOC Analyst must review and authorise before it is submitted to the platform.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3.5">
          {error && (
            <div className="text-red-400 text-xs bg-red-950/30 border border-red-900/30 rounded px-3 py-2">{error}</div>
          )}

          {/* Influencer */}
          <div>
            <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Protected Influencer *</label>
            {influencerList.length === 0 ? (
              <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 rounded px-3 py-2">
                No influencer profiles. Create one in Admin → Influencers first.
              </div>
            ) : (
              <select
                className="soc-select"
                value={form.influencer_id}
                onChange={(e) => setForm((f) => ({ ...f, influencer_id: e.target.value }))}
                required
              >
                <option value="">— select influencer —</option>
                {influencerList.map((inf) => (
                  <option key={inf.id} value={inf.id}>{inf.display_name} (@{inf.handle})</option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Platform */}
            <div>
              <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Platform *</label>
              <select
                className="soc-select"
                value={form.platform}
                onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                disabled={isPrefilled}
              >
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Suspect handle */}
            <div>
              <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Suspect Handle *</label>
              <input
                className="soc-input"
                placeholder="@handle"
                value={form.suspect_handle}
                onChange={(e) => setForm((f) => ({ ...f, suspect_handle: e.target.value }))}
                readOnly={isPrefilled}
                required
              />
            </div>
          </div>

          {/* Takedown type */}
          <div>
            <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Report Type *</label>
            <select
              className="soc-select"
              value={form.takedown_type}
              onChange={(e) => setForm((f) => ({ ...f, takedown_type: e.target.value as TakedownType }))}
            >
              {TAKEDOWN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Linked IOI report */}
          {prefill?.report_id && (
            <div>
              <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Linked IOI Report</label>
              <input className="soc-input opacity-60" value={form.report_id} readOnly />
            </div>
          )}

          {/* Analyst notes */}
          <div>
            <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Initial Notes (optional)</label>
            <textarea
              className="soc-input w-full min-h-[70px] resize-y"
              placeholder="Describe the impersonation, evidence found, or instructions for the reviewing analyst..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button
              type="submit"
              disabled={saving || !form.influencer_id || !form.suspect_handle.trim()}
              className="btn-gold flex items-center gap-2 flex-1 justify-center"
            >
              <Flag size={13} />
              {saving ? "Creating…" : "Create Draft Takedown"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
