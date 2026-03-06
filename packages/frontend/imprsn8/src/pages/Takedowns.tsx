import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { RefreshCw, ChevronLeft, Lock, Check, X, Flag, Plus } from "lucide-react";
import { takedowns } from "../lib/api";
import { TakedownStatusBadge } from "../components/ui/SeverityBadge";
import { PlatformIcon } from "../components/ui/PlatformIcon";
import { CreateTakedownModal } from "../components/CreateTakedownModal";
import type { TakedownRequest, InfluencerProfile, User, TakedownStatus } from "../lib/types";

interface Ctx {
  user: User;
  selectedInfluencer: InfluencerProfile | null;
  influencerList: InfluencerProfile[];
}

function timeAgo(ts: string | null | undefined): string {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const ACTIVE_STATUSES: TakedownStatus[] = ["draft", "submitted", "acknowledged", "in_review"];
const DONE_STATUSES: TakedownStatus[] = ["resolved", "rejected"];

function TakedownDetail({
  td,
  user,
  onBack,
  onUpdate,
}: {
  td: TakedownRequest;
  user: User;
  onBack: () => void;
  onUpdate: (id: string, data: { status?: TakedownStatus; case_ref?: string; resolution?: string }) => Promise<void>;
}) {
  const [notes, setNotes] = useState(td.resolution ?? "");
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const isDone = DONE_STATUSES.includes(td.status);
  const canAuthorise = user.role === "soc" || user.role === "admin";

  async function handleSubmit() {
    setSaving(true);
    try {
      await onUpdate(td.id, { status: "submitted", resolution: notes });
      setConfirm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDismiss() {
    setSaving(true);
    try {
      await onUpdate(td.id, { status: "rejected", resolution: notes || "Dismissed by analyst" });
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
        <h1 className="text-xl font-bold text-slate-100">Takedown Review</h1>
        <span className="badge-submitted capitalize">{td.takedown_type.replace(/_/g, " ")}</span>
        <TakedownStatusBadge status={td.status} />
      </div>

      {/* HITL Warning */}
      <div className="soc-card border-threat-critical/30 bg-threat-critical/5 flex gap-3">
        <Lock size={20} className="text-threat-critical shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-bold text-threat-critical mb-1">HUMAN-IN-THE-LOOP CHECKPOINT</div>
          <div className="text-xs text-slate-400 leading-relaxed">
            ARBITER prepared this package but cannot submit it. Review all evidence, add your analyst assessment,
            then explicitly authorise. This action is permanently audit-logged and attributed to your account ({user.email}).
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Package details */}
        <div className="soc-card">
          <div className="text-[10px] font-bold text-slate-500 tracking-widest mb-3">PACKAGE DETAILS</div>
          <div className="space-y-0">
            {[
              ["Target Account", `@${td.suspect_handle}`],
              ["Platform", td.platform],
              ["Report Type", td.takedown_type.replace(/_/g, " ")],
              ["Case Ref", td.case_ref ?? "—"],
              ["Filed", td.submitted_at ? timeAgo(td.submitted_at) : "Pending"],
              ["Filed By", td.submitted_by_name ?? "Pending"],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between py-2 border-b border-soc-border text-sm last:border-0">
                <span className="text-slate-500">{label}</span>
                <span className="font-medium text-slate-200 capitalize">{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Evidence */}
        <div className="soc-card">
          <div className="text-[10px] font-bold text-slate-500 tracking-widest mb-3">
            EVIDENCE BUNDLE ({td.evidence_json?.length ?? 0} items)
          </div>
          {!td.evidence_json?.length ? (
            <div className="text-slate-500 text-sm text-center py-4">No evidence attached</div>
          ) : (
            <div className="space-y-2">
              {td.evidence_json.map((e, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 px-3 py-2.5 bg-status-live/5 border border-status-live/20 rounded-lg"
                >
                  <Check size={13} className="text-status-live shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-300">{e.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Analyst assessment */}
      {!isDone && canAuthorise && (
        <div className="soc-card">
          <div className="text-[10px] font-bold text-slate-500 tracking-widest mb-3">ANALYST ASSESSMENT (required)</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add your assessment, additional findings, or caveats before authorising..."
            className="soc-input w-full min-h-[90px] resize-y"
          />
        </div>
      )}

      {/* Action zone */}
      {isDone ? (
        <div className="soc-card text-center py-8">
          <div className="text-3xl mb-3">{td.status === "resolved" ? "✅" : "❌"}</div>
          <div className={`font-bold text-lg ${td.status === "resolved" ? "text-status-live" : "text-slate-500"}`}>
            {td.status === "resolved" ? "Takedown submitted successfully" : "Dismissed"}
          </div>
          {td.submitted_at && (
            <div className="text-slate-500 text-sm mt-2">
              Filed {timeAgo(td.submitted_at)} · {td.submitted_by_name ?? "Unknown analyst"}
            </div>
          )}
        </div>
      ) : !canAuthorise ? (
        <div className="soc-card text-center py-6 text-slate-500 text-sm">
          <Lock size={16} className="mx-auto mb-2" />
          SOC Analyst or Admin role required to authorise takedowns
        </div>
      ) : !confirm ? (
        <div className="flex gap-2">
          <button onClick={() => setConfirm(true)} className="btn-gold flex items-center gap-2 flex-1 justify-center">
            <Flag size={14} /> Authorise & Submit Takedown
          </button>
          <button onClick={handleDismiss} disabled={saving} className="btn-ghost flex items-center gap-1.5">
            <X size={14} /> Dismiss
          </button>
        </div>
      ) : (
        <div className="soc-card border-threat-critical/30">
          <div className="font-bold text-threat-critical text-lg mb-2">⚠ Final Confirmation</div>
          <p className="text-slate-400 text-sm leading-relaxed mb-5">
            You are authorising ARBITER to submit a{" "}
            <strong className="text-slate-200">{td.takedown_type.replace(/_/g, " ")}</strong> to{" "}
            <strong className="text-slate-200">{td.platform}</strong> against{" "}
            <strong className="text-slate-200">@{td.suspect_handle}</strong>. This is irreversible and will be permanently logged.
          </p>
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={saving} className="btn-gold flex items-center gap-2 flex-1 justify-center">
              <Flag size={14} /> CONFIRM — Authorise Takedown
            </button>
            <button onClick={() => setConfirm(false)} disabled={saving} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Takedowns() {
  const { user, selectedInfluencer, influencerList } = useOutletContext<Ctx>();
  const [list, setList] = useState<TakedownRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TakedownRequest | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const canCreate = user.role === "soc" || user.role === "admin";

  async function load() {
    setLoading(true);
    try {
      const data = await takedowns.list({ influencer_id: selectedInfluencer?.id });
      setList(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [selectedInfluencer]);

  async function handleUpdate(id: string, data: { status?: TakedownStatus; case_ref?: string; resolution?: string }) {
    const updated = await takedowns.update(id, data);
    setList((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setSelected(updated);
  }

  if (selected) {
    return (
      <TakedownDetail
        td={selected}
        user={user}
        onBack={() => setSelected(null)}
        onUpdate={handleUpdate}
      />
    );
  }

  const pending = list.filter((t) => ACTIVE_STATUSES.includes(t.status));
  const done = list.filter((t) => DONE_STATUSES.includes(t.status));

  return (
    <>
    {showCreate && (
      <CreateTakedownModal
        influencerList={influencerList}
        prefill={selectedInfluencer ? { influencer_id: selectedInfluencer.id } : undefined}
        onCreated={(td) => { setList((prev) => [td, ...prev]); setShowCreate(false); }}
        onClose={() => setShowCreate(false)}
      />
    )}
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Takedown Queue</h1>
          <p className="text-xs text-slate-500 mt-0.5">ARBITER-Prepared · Human Authorisation Required · Audit-Logged</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-1 rounded-full border ${
            pending.length > 0 ? "bg-threat-high/10 border-threat-high/30 text-threat-high" : "bg-status-live/10 border-status-live/30 text-status-live"
          }`}>
            {pending.length} AWAITING REVIEW
          </span>
          {canCreate && (
            <button onClick={() => setShowCreate(true)} className="btn-gold flex items-center gap-1.5 !py-1.5 !px-3 !text-xs">
              <Plus size={12} /> New Takedown
            </button>
          )}
          <button onClick={load} disabled={loading} className="btn-icon">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* HITL gate banner */}
      <div className="soc-card border-threat-critical/30 bg-threat-critical/5 flex items-center gap-3">
        <Lock size={20} className="text-threat-critical shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-bold text-threat-critical">HITL Gate Active — ARBITER cannot submit without analyst authorisation</div>
          <div className="text-xs text-slate-400 mt-0.5">All takedown actions require explicit SOC Analyst review and sign-off. No exceptions. No overrides.</div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Pending */}
          {pending.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                Pending Review
                <span className="badge-high">{pending.length}</span>
              </div>
              {pending.map((td) => (
                <div
                  key={td.id}
                  onClick={() => setSelected(td)}
                  className="soc-card flex items-center gap-4 flex-wrap cursor-pointer hover:border-soc-border-bright transition-all"
                >
                  <div className="flex-1 min-w-[180px]">
                    <div className="font-bold text-slate-100 font-mono mb-1">@{td.suspect_handle}</div>
                    <div className="text-xs text-slate-500 mb-2">
                      {td.influencer_name} · {td.platform} · {td.takedown_type.replace(/_/g, " ")}
                    </div>
                    {td.evidence_json && td.evidence_json.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {td.evidence_json.slice(0, 2).map((e, i) => (
                          <span key={i} className="badge-dismissed text-[9px]">{e.description.slice(0, 30)}</span>
                        ))}
                        {td.evidence_json.length > 2 && (
                          <span className="badge-dismissed text-[9px]">+{td.evidence_json.length - 2} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <TakedownStatusBadge status={td.status} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed */}
          {done.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-500">Completed</div>
              {done.map((td) => (
                <div
                  key={td.id}
                  onClick={() => setSelected(td)}
                  className="soc-card flex items-center gap-4 flex-wrap cursor-pointer hover:border-soc-border-bright transition-all opacity-70"
                >
                  <PlatformIcon platform={td.platform as never} size="sm" />
                  <div className="flex-1">
                    <div className="font-medium text-slate-200 font-mono text-sm">@{td.suspect_handle}</div>
                    <div className="text-xs text-slate-500">
                      {td.influencer_name} · {td.platform}
                      {td.submitted_at ? ` · Filed ${timeAgo(td.submitted_at)}` : ""}
                    </div>
                  </div>
                  <TakedownStatusBadge status={td.status} />
                </div>
              ))}
            </div>
          )}

          {list.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <div className="text-4xl mb-3">✅</div>
              <div>No takedowns in queue</div>
              {canCreate && (
                <button onClick={() => setShowCreate(true)} className="text-gold text-sm mt-2 hover:underline">
                  Create the first takedown →
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
    </>
  );
}
