import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Link2, UserPlus, Copy, Check, Mail, AlertTriangle, ExternalLink } from "lucide-react";
import { invites, type InviteToken, type DirectCreateResult } from "../lib/api";
import type { InfluencerProfile } from "../lib/types";

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border border-soc-border hover:border-gold/40 text-slate-400 hover:text-gold transition-colors"
    >
      {copied ? <Check size={10} className="text-status-live" /> : <Copy size={10} />}
      {copied ? "Copied!" : label}
    </button>
  );
}

// ─── Share Link Tab ───────────────────────────────────────────────────────────
function ShareLinkTab({ influencer }: { influencer: InfluencerProfile }) {
  const [role, setRole] = useState<"influencer" | "staff">("influencer");
  const [emailHint, setEmailHint] = useState("");
  const [notes, setNotes] = useState("");
  const [expiresDays, setExpiresDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<InviteToken | null>(null);

  const inviteUrl = result
    ? `${window.location.origin}/register?invite=${result.token}`
    : null;

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const invite = await invites.create({
        influencer_id: influencer.id,
        role,
        email_hint: emailHint.trim() || undefined,
        notes: notes.trim() || undefined,
        expires_days: expiresDays,
      });
      setResult(invite);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate invite");
    } finally {
      setLoading(false);
    }
  }

  if (result && inviteUrl) {
    return (
      <div className="space-y-4">
        {/* Success state */}
        <div className="soc-card border-status-live/20 bg-status-live/5 space-y-3">
          <div className="flex items-center gap-2 text-status-live text-xs font-semibold">
            <Check size={14} />
            Invite link generated
          </div>
          <div className="text-[10px] text-slate-500">
            Expires {new Date(result.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            {" · "}
            Role: <span className="text-slate-300 capitalize">{result.role}</span>
          </div>

          {/* URL display */}
          <div className="bg-soc-bg rounded border border-soc-border p-3">
            <div className="flex items-start justify-between gap-2">
              <code className="text-[10px] text-gold font-mono break-all flex-1">{inviteUrl}</code>
              <CopyButton text={inviteUrl} label="Copy link" />
            </div>
          </div>

          {/* Instructions */}
          <div className="text-[10px] text-slate-500 space-y-1 border-t border-soc-border/50 pt-3">
            <div className="font-semibold text-slate-400 mb-1.5">How to share (no email needed):</div>
            <div>1. Copy the link above</div>
            <div>2. Send via DM, Slack, text, or any channel</div>
            <div>3. {influencer.display_name} opens it, creates their own password</div>
            <div>4. Their account is automatically linked to this influencer profile</div>
          </div>
        </div>

        {/* Email note */}
        <div className="flex items-start gap-2 text-[10px] text-slate-600 bg-soc-bg/60 rounded p-3 border border-soc-border/50">
          <Mail size={12} className="mt-0.5 shrink-0 text-slate-600" />
          <span>
            <span className="text-slate-400 font-medium">Email integration not configured.</span>{" "}
            The invite was not sent automatically. Configure an email provider in Admin → Settings to enable automatic sending.
          </span>
        </div>

        <button
          onClick={() => { setResult(null); setEmailHint(""); setNotes(""); }}
          className="btn-ghost !text-xs w-full"
        >
          Generate another
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Generate a one-time link for <span className="text-slate-300 font-medium">{influencer.display_name}</span> to self-register.
        Share it via DM, text, or any channel — no email needed.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Role</label>
          <select
            className="soc-select w-full"
            value={role}
            onChange={(e) => setRole(e.target.value as "influencer" | "staff")}
          >
            <option value="influencer">Influencer</option>
            <option value="staff">Staff</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Expires in (days)</label>
          <select
            className="soc-select w-full"
            value={expiresDays}
            onChange={(e) => setExpiresDays(Number(e.target.value))}
          >
            {[1, 3, 7, 14, 30].map((d) => (
              <option key={d} value={d}>{d} {d === 1 ? "day" : "days"}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">
          Email hint <span className="text-slate-700">(optional — pre-fills the register form)</span>
        </label>
        <input
          className="soc-input w-full"
          type="email"
          placeholder="influencer@example.com"
          value={emailHint}
          onChange={(e) => setEmailHint(e.target.value)}
        />
      </div>

      <div>
        <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">
          Notes <span className="text-slate-700">(admin only)</span>
        </label>
        <input
          className="soc-input w-full"
          placeholder="e.g. Sent via Instagram DM"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-950/30 border border-red-900/30 rounded px-3 py-2">
          <AlertTriangle size={12} />
          {error}
        </div>
      )}

      <button
        onClick={generate}
        disabled={loading}
        className="btn-gold w-full flex items-center justify-center gap-2"
      >
        <Link2 size={14} />
        {loading ? "Generating…" : "Generate invite link"}
      </button>
    </div>
  );
}

// ─── Create Directly Tab ──────────────────────────────────────────────────────
function CreateDirectlyTab({ influencer }: { influencer: InfluencerProfile }) {
  const [form, setForm] = useState({ email: "", display_name: "", role: "influencer" as "influencer" | "staff" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DirectCreateResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await invites.directCreate({
        email: form.email.trim(),
        influencer_id: influencer.id,
        role: form.role,
        display_name: form.display_name.trim() || undefined,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="soc-card border-gold/20 bg-gold/5 space-y-3">
          <div className="flex items-center gap-2 text-gold text-xs font-semibold">
            <Check size={14} />
            Account created — share these credentials
          </div>
          <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
            <AlertTriangle size={11} className="text-gold" />
            The password is shown once and not stored in plaintext. Copy it now.
          </div>

          <div className="space-y-2">
            {[
              { label: "Login URL", value: `${window.location.origin}/login` },
              { label: "Email", value: result.email },
              { label: "Password", value: result.generated_password },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-3 bg-soc-bg rounded border border-soc-border px-3 py-2">
                <div>
                  <div className="text-[9px] text-slate-600 uppercase tracking-wider">{label}</div>
                  <code className="text-xs text-gold font-mono">{value}</code>
                </div>
                <CopyButton text={value} />
              </div>
            ))}
          </div>

          {/* One-shot copy */}
          <CopyButton
            text={`Login: ${window.location.origin}/login\nEmail: ${result.email}\nPassword: ${result.generated_password}`}
            label="Copy all as text"
          />
        </div>

        <div className="flex items-start gap-2 text-[10px] text-slate-600 bg-soc-bg/60 rounded p-3 border border-soc-border/50">
          <Mail size={12} className="mt-0.5 shrink-0" />
          <span>
            <span className="text-slate-400 font-medium">Email not sent.</span>{" "}
            Share these credentials manually. They can change their password after first login in Account Settings.
          </span>
        </div>

        <button
          onClick={() => { setResult(null); setForm({ email: "", display_name: "", role: "influencer" }); }}
          className="btn-ghost !text-xs w-full"
        >
          Create another
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Create an account for <span className="text-slate-300 font-medium">{influencer.display_name}</span> directly.
        A strong password is generated — copy it and share via DM or any channel.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Email *</label>
          <input
            className="soc-input w-full"
            type="email"
            placeholder="influencer@example.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Display name</label>
          <input
            className="soc-input w-full"
            placeholder={influencer.display_name}
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Role</label>
          <select
            className="soc-select w-full"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "influencer" | "staff" }))}
          >
            <option value="influencer">Influencer</option>
            <option value="staff">Staff</option>
          </select>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-950/30 border border-red-900/30 rounded px-3 py-2">
            <AlertTriangle size={12} />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !form.email.trim()}
          className="btn-gold w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <UserPlus size={14} />
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────
type InviteTab = "link" | "direct";

export function InviteInfluencerModal({
  influencer,
  onClose,
}: {
  influencer: InfluencerProfile;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<InviteTab>("link");

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-soc-card border border-soc-border rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-soc-border">
          <div>
            <h2 className="font-bold text-slate-100 text-sm">Invite Influencer</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              {influencer.avatar_url ? (
                <img src={influencer.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
              ) : null}
              <span className="text-[10px] text-slate-500">{influencer.display_name} · @{influencer.handle}</span>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon !p-1.5"><X size={14} /></button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-soc-border">
          {([
            { id: "link",   label: "Share Link",       icon: <Link2 size={12} /> },
            { id: "direct", label: "Create Directly",  icon: <UserPlus size={12} /> },
          ] as { id: InviteTab; label: string; icon: React.ReactNode }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 flex-1 justify-center py-2.5 text-xs font-medium border-b-2 -mb-px transition-all ${
                tab === t.id
                  ? "text-gold border-gold"
                  : "text-slate-500 border-transparent hover:text-slate-300"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {tab === "link"   && <ShareLinkTab   influencer={influencer} />}
          {tab === "direct" && <CreateDirectlyTab influencer={influencer} />}
        </div>

        {/* Footer note */}
        <div className="px-5 pb-4 flex items-center gap-1.5 text-[10px] text-slate-700">
          <ExternalLink size={9} />
          Email sending available once an email provider is configured in Admin → Settings
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
