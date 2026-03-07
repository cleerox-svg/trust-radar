import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../lib/api";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { WordMark } from "../components/LogoMark";

export default function Login() {
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
      const { token } = await auth.login(email, password);
      localStorage.setItem("imprsn8_token", token);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-brand-bg flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Floating theme toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Ambient glow orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-brand-purple/10 blur-[120px]" />
        <div className="absolute bottom-0 -right-40 w-[400px] h-[400px] rounded-full bg-brand-pink/8 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md space-y-6">
        {/* Brand mark */}
        <div className="flex justify-center mb-2">
          <WordMark variant="shield" size={32} textSize="text-2xl" />
        </div>

        <div className="card w-full space-y-6" style={{ boxShadow: "0 0 60px rgba(139,92,246,0.12)" }}>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold gradient-text">Welcome back</h2>
            <p className="text-brand-muted text-sm">Sign in to view your impression score.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm text-slate-400">Email</label>
              <input
                type="email" className="input" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                required disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-slate-400">Password</label>
              <input
                type="password" className="input" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                required disabled={loading}
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="text-center text-sm text-brand-muted">
            No account?{" "}
            <Link to="/register" className="text-brand-pink hover:underline">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
