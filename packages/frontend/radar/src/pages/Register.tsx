import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../App";

export default function Register() {
  const { register, user, authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-radar-bg">
      <div className="w-6 h-6 border-2 border-radar-cyan border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-radar-bg flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-radar-border">
        <div className="w-7 h-7 rounded-lg bg-radar-cyan/20 border border-radar-cyan/40 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-radar-cyan" />
        </div>
        <span className="font-bold text-radar-text text-sm">Trust Radar</span>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-radar-text">Create account</h1>
            <p className="text-xs text-radar-muted mt-1">Start scanning URLs and tracking signals</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-radar-muted uppercase tracking-wide">Email</label>
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
              <label className="text-xs font-medium text-radar-muted uppercase tracking-wide">Password</label>
              <input
                type="password"
                className="input"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                disabled={loading}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="text-xs text-radar-red bg-radar-red/10 border border-radar-red/20 rounded-lg px-3 py-2 font-mono">
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
                  Creating account…
                </span>
              ) : "Create account"}
            </button>
          </form>

          <p className="text-center text-xs text-radar-muted">
            Already have an account?{" "}
            <Link to="/login" className="text-radar-cyan hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
