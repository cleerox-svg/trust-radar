import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Clock, Monitor } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { relativeTime } from '@/lib/time';

interface SessionData {
  total: number;
  sessions: Array<{
    id: string;
    ip_address: string;
    user_agent: string;
    issued_at: string;
  }>;
}

export function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [saved, setSaved] = useState(false);

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const roleName = user?.role === 'super_admin' ? 'Super Admin'
    : user?.role === 'admin' ? 'Admin'
    : user?.role === 'analyst' ? 'Analyst'
    : 'Client';

  const { data: sessionData } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await api.get<SessionData>('/api/admin/sessions');
      return res.data;
    },
  });

  const forceLogout = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      await api.post(`/api/admin/users/${user.id}/force-logout`);
    },
  });

  const handleSaveName = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto page-enter">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="glass-btn p-2 rounded-lg touch-target"
        >
          <ArrowLeft className="w-4 h-4 text-white/60" />
        </button>
        <h1 className="font-mono text-[10px] uppercase tracking-[0.15em] text-contrail/70 font-bold">
          Profile & Settings
        </h1>
      </div>

      <div className="glass-card-amber rounded-xl p-6 mb-4" style={{ background:'rgba(15,23,42,0.50)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'0.75rem', boxShadow:'0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#C83C3C] flex items-center justify-center text-lg font-bold text-white ring-2 ring-white/20 flex-shrink-0">
            {initials}
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{user?.name ?? 'User'}</h2>
            <p className="text-[12px] text-white/40 mt-0.5">
              {user?.email} · {roleName}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl p-5 mb-4" style={{ background:'rgba(15,23,42,0.50)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'0.75rem', boxShadow:'0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Monitor size={14} style={{ color: 'var(--amber)' }} />
          <span className="section-label">Account</span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono text-white/50 uppercase tracking-wider mb-1.5">
              Display Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="glass-input rounded-lg px-3 py-2 text-[13px] flex-1"
              />
              <button
                onClick={handleSaveName}
                className="glass-btn px-4 py-2 rounded-lg text-[11px] font-mono uppercase tracking-wider hover:text-afterburner-hover transition-colors" style={{ color: 'var(--amber)' }}
              >
                {saved ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-white/50 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <div className="glass-input rounded-lg px-3 py-2 text-[13px] text-white/40 cursor-not-allowed">
              {user?.email}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-white/50 uppercase tracking-wider mb-1.5">
              Role
            </label>
            <div className="glass-input rounded-lg px-3 py-2 text-[13px] text-white/40 cursor-not-allowed">
              {roleName}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl p-5 mb-4" style={{ background:'rgba(15,23,42,0.50)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'0.75rem', boxShadow:'0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Shield size={14} style={{ color: 'var(--amber)' }} />
          <span className="section-label">Security</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-parchment/80">Active Sessions</p>
              <p className="text-[11px] text-white/40 mt-0.5">
                {sessionData?.total ?? 0} sessions
              </p>
            </div>
            <button
              onClick={() => forceLogout.mutate()}
              disabled={forceLogout.isPending}
              className="glass-btn px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider text-[#C83C3C]/70 hover:text-[#C83C3C] hover:border-[#C83C3C]/30 transition-colors touch-target"
            >
              {forceLogout.isPending ? 'Revoking...' : 'Revoke all other sessions'}
            </button>
          </div>

          {sessionData?.sessions && sessionData.sessions.length > 0 && (
            <div className="mt-3 space-y-2">
              {sessionData.sessions.slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center justify-between py-1.5 border-t border-white/5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-white/50 truncate">{s.ip_address ?? 'Unknown IP'}</p>
                  </div>
                  <span className="text-[10px] font-mono text-white/50 flex-shrink-0 ml-2">
                    {relativeTime(s.issued_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background:'rgba(15,23,42,0.50)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'0.75rem', boxShadow:'0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Clock size={14} style={{ color: 'var(--amber)' }} />
          <span className="section-label">Preferences</span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono text-white/50 uppercase tracking-wider mb-2">
              Theme
            </label>
            <div className="flex gap-2">
              {['Dark', 'Light', 'System'].map(theme => (
                <button
                  key={theme}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wider touch-target ${
                    theme === 'Dark'
                      ? 'glass-btn-active text-[#00D4FF]'
                      : 'glass-btn text-white/40'
                  }`}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-white/50 uppercase tracking-wider mb-1.5">
              Timezone
            </label>
            <div className="glass-input rounded-lg px-3 py-2 text-[13px] text-white/60">
              {Intl.DateTimeFormat().resolvedOptions().timeZone} (auto-detected)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
