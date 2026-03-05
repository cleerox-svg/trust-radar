import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../lib/api";

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { token } = await auth.register(email, password);
      localStorage.setItem("radar_token", token);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="card w-full max-w-md space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-100">Create account</h2>
          <p className="text-radar-muted text-sm">Start scanning URLs and track your history.</p>
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
              disabled={loading}
            />
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

          {error && <p className="text-radar-red text-sm font-mono">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-radar-muted">
          Already have an account?{" "}
          <Link to="/login" className="text-radar-green hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
