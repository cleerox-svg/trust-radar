import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../lib/api";
import { TrustRadarLogo } from "./TrustRadarLogo";

export default function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem("imprsn8_token");
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!token) return;
    auth.me().then((u) => setIsAdmin(u.is_admin === 1)).catch(() => {});
  }, [token]);

  function logout() {
    localStorage.removeItem("imprsn8_token");
    navigate("/");
    setOpen(false);
  }

  return (
    <nav className="border-b border-brand-border bg-brand-card/60 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" onClick={() => setOpen(false)} className="group-hover:opacity-80 transition-opacity">
          {/* Desktop: full logo */}
          <span className="hidden sm:inline-flex">
            <TrustRadarLogo variant="topbar" theme="dark" />
          </span>
          {/* Mobile: icon only */}
          <span className="inline-flex sm:hidden">
            <TrustRadarLogo variant="icon" theme="dark" />
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-4">
          {token ? (
            <>
              <Link to="/dashboard" className="text-sm text-slate-400 hover:text-brand-purple transition-colors">
                Dashboard
              </Link>
              {isAdmin && (
                <Link to="/admin" className="text-sm text-red-400 hover:text-red-300 transition-colors font-mono">
                  Admin
                </Link>
              )}
              <button onClick={logout} className="text-sm text-slate-400 hover:text-red-400 transition-colors">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
                Sign in
              </Link>
              <Link to="/register" className="btn-primary text-sm py-2 px-4">
                Get started
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden p-2 rounded text-slate-400 hover:text-slate-200 transition-colors"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="sm:hidden border-t border-brand-border bg-brand-card px-4 py-3 space-y-2">
          {token ? (
            <>
              <Link to="/dashboard" onClick={() => setOpen(false)} className="block py-2 text-sm text-slate-400 hover:text-brand-purple transition-colors">
                Dashboard
              </Link>
              {isAdmin && (
                <Link to="/admin" onClick={() => setOpen(false)} className="block py-2 text-sm text-red-400 hover:text-red-300 transition-colors font-mono">
                  Admin
                </Link>
              )}
              <button onClick={logout} className="block w-full text-left py-2 text-sm text-slate-400 hover:text-red-400 transition-colors">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)} className="block py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                Sign in
              </Link>
              <Link to="/register" onClick={() => setOpen(false)} className="btn-primary text-sm py-2 px-4 inline-block">
                Get started
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
