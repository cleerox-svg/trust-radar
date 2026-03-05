import { Link, useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem("imprsn8_token");

  function logout() {
    localStorage.removeItem("imprsn8_token");
    navigate("/");
  }

  return (
    <nav className="border-b border-brand-border bg-brand-card/60 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-bold text-xl gradient-text tracking-tight">
          imprsn8
        </Link>

        <div className="flex items-center gap-4">
          {token ? (
            <>
              <Link to="/dashboard" className="text-sm text-slate-400 hover:text-brand-purple transition-colors">
                Dashboard
              </Link>
              <button onClick={logout} className="text-sm text-slate-400 hover:text-red-400 transition-colors">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
                Login
              </Link>
              <Link to="/register" className="btn-primary text-sm py-2 px-4">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
