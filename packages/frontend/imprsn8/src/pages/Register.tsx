import { useState, useEffect, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { auth, invites, type InviteValidation } from "../lib/api";

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? undefined;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Invite state
  const [inviteInfo, setInviteInfo] = useState<InviteValidation | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken);

  // Validate invite token on mount
  useEffect(() => {
    if (!inviteToken) return;
    setInviteLoading(true);
    invites.validate(inviteToken)
      .then((info) => {
        setInviteInfo(info);
        if (info.email_hint) setEmail(info.email_hint);
      })
      .catch((e) => setInviteError(e instanceof Error ? e.message : "Invalid invite link"))
      .finally(() => setInviteLoading(false));
  }, [inviteToken]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { token } = await auth.register(email, password, inviteToken);
      localStorage.setItem("imprsn8_token", token);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const pageShell = (children: ReactNode) => (
    <div className="relative min-h-screen bg-brand-bg flex flex-col items-center justify-center px-4 overflow-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-brand-purple/10 blur-[120px]" />
        <div className="absolute bottom-0 -right-40 w-[400px] h-[400px] rounded-full bg-brand-pink/8 blur-[100px]" />
      </div>
      <div className="relative w-full max-w-md space-y-6">
        <div className="text-center mb-2">
          <span className="text-2xl font-extrabold tracking-tight gradient-text"
            style={{ filter: "drop-shadow(0 0 20px rgba(139,92,246,0.5))" }}>
            imprsn8
          </span>
        </div>
        {children}
      </div>
    </div>
  );

  // Loading invite validation
  if (inviteLoading) {
    return pageShell(
      <div className="flex justify-center">
        <div className="w-7 h-7 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Bad invite token
  if (inviteToken && inviteError) {
    return pageShell(
      <div className="card w-full space-y-4 text-center" style={{ boxShadow: "0 0 60px rgba(139,92,246,0.12)" }}>
        <div className="text-4xl">🔗</div>
        <h2 className="text-xl font-bold text-slate-100">Invalid invite</h2>
        <p className="text-slate-400 text-sm">{inviteError}</p>
        <p className="text-sm text-brand-muted">
          Ask your admin for a new invite link, or{" "}
          <Link to="/register" className="text-brand-pink hover:underline">register without one</Link>.
        </p>
      </div>
    );
  }

  return pageShell(
    <div className="card w-full space-y-6" style={{ boxShadow: "0 0 60px rgba(139,92,246,0.12)" }}>

        {/* Invite context banner */}
        {inviteInfo && (
          <div className="bg-brand-purple/10 border border-brand-purple/30 rounded-lg p-4 flex items-center gap-3">
            {inviteInfo.avatar_url ? (
              <img src={inviteInfo.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-brand-purple/40" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-brand-purple/20 border border-brand-purple/40 flex items-center justify-center text-lg font-bold text-brand-purple">
                {inviteInfo.influencer_name[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-[10px] text-brand-pink uppercase tracking-widest font-bold mb-0.5">You're invited</div>
              <div className="text-sm font-semibold text-slate-200">{inviteInfo.influencer_name}</div>
              <div className="text-[10px] text-slate-500">
                @{inviteInfo.handle} · joining as <span className="capitalize">{inviteInfo.role}</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <h2 className="text-2xl font-bold gradient-text">
            {inviteInfo ? "Complete your account" : "Get your score"}
          </h2>
          <p className="text-brand-muted text-sm">
            {inviteInfo
              ? "Create your password to finish setting up access."
              : "Create a free account to analyze your digital impression."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-slate-400">Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || !!inviteInfo?.email_hint}
            />
            {inviteInfo?.email_hint && (
              <p className="text-[10px] text-slate-600">Pre-filled from your invite.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-slate-400">Password</label>
            <input
              type="password"
              className="input"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              disabled={loading}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Creating account…" : inviteInfo ? "Create account & join" : "Create free account"}
          </button>
        </form>

        <p className="text-center text-sm text-brand-muted">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-pink hover:underline">Sign in</Link>
        </p>
      </div>
  );
}
