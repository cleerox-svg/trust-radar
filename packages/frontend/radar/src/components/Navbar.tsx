import { Link, useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem("radar_token");

  function logout() {
    localStorage.removeItem("radar_token");
    navigate("/");
  }

  return (
    <nav className="border-b border-radar-border bg-radar-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-mono font-bold text-radar-green">
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-radar-green">
            <circle cx="12" cy="12" r="10" fillOpacity="0.1" stroke="#00ff88" strokeWidth="1.5" fill="none" />
            <circle cx="12" cy="12" r="6" fillOpacity="0.1" stroke="#00ff88" strokeWidth="1" fill="none" />
            <circle cx="12" cy="12" r="2" fill="#00ff88" />
            <line x1="12" y1="12" x2="12" y2="4" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          TRUST RADAR
        </Link>

        <div className="flex items-center gap-4">
          {token ? (
            <>
              <Link to="/history" className="text-sm text-slate-400 hover:text-radar-green transition-colors">
                History
              </Link>
              <button onClick={logout} className="text-sm text-slate-400 hover:text-radar-red transition-colors">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
                Login
              </Link>
              <Link to="/register" className="btn-primary text-sm py-2 px-4">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
