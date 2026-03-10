import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../App";

export default function Login() {
  const { login, user, authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface-base)" }}>
      <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--surface-base)" }}>
      {/* Top bar */}
      <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
        </div>
        <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Trust Radar</span>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Sign in</h1>
            <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Access your signal intelligence dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 font-mono" style={{ color: "var(--threat-critical)" }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in...
                </span>
              ) : "Sign in"}
            </button>
          </form>

          <p className="text-center text-xs" style={{ color: "var(--text-tertiary)" }}>
            No account?{" "}
            <Link to="/register" className="text-cyan-400 hover:underline font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
