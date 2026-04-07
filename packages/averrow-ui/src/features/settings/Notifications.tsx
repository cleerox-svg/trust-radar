import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function Notifications() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto page-enter">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="glass-btn p-2 rounded-lg touch-target"
        >
          <ArrowLeft className="w-4 h-4 text-white/60" />
        </button>
        <h1 className="font-mono text-[10px] uppercase tracking-[0.15em] text-contrail/70 font-bold">
          All Notifications
        </h1>
      </div>

      <div className="glass-card-amber rounded-xl p-12 text-center" style={{ background:'rgba(15,23,42,0.50)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'0.75rem', boxShadow:'0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        <p className="text-[13px] text-white/40 font-mono">
          Full notification history coming soon.
        </p>
        <p className="text-[11px] text-white/40 font-mono mt-2">
          Use the bell icon for recent notifications.
        </p>
      </div>
    </div>
  );
}
