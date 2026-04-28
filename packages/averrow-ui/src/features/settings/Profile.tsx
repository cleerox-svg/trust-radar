import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Clock, Monitor, Key, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { relativeTime } from '@/lib/time';
import { Button, Input } from '@/design-system/components';
import { parseInitials, SELF_AVATAR_COLOR } from '@/lib/avatar';
import {
  isPasskeySupported, registerPasskey, listPasskeys, removePasskey,
  type PasskeyDevice,
} from '@/lib/passkeys';

const readonlyField: React.CSSProperties = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-base)',
  color: 'var(--text-tertiary)',
};

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
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [saved, setSaved] = useState(false);

  // ─── Passkey state ─────────────────────────────────────────────
  const passkeySupported = isPasskeySupported();
  const { data: passkeys } = useQuery({
    queryKey: ['passkeys'],
    queryFn: listPasskeys,
    enabled: passkeySupported,
  });
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  const handleAddPasskey = async () => {
    setPasskeyBusy(true);
    setPasskeyError(null);
    try {
      await registerPasskey();
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
    } catch (err) {
      // DOMException with NotAllowedError = user cancelled prompt — silent.
      if (!(err instanceof DOMException) || (err.name !== 'NotAllowedError' && err.name !== 'AbortError')) {
        setPasskeyError(err instanceof Error ? err.message : 'Failed to add passkey.');
      }
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleRemovePasskey = async (id: string) => {
    try {
      await removePasskey(id);
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
    } catch { /* swallow */ }
  };

  const initials = parseInitials(user?.name, user?.email);

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
          className="p-2 rounded-lg touch-target"
          style={{
            background: 'transparent',
            border: '1px solid var(--border-base)',
            color: 'var(--text-secondary)',
            transition: 'var(--transition-fast)',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="font-mono text-[10px] uppercase tracking-[0.15em] text-[rgba(255,255,255,0.42)] font-bold">
          Profile & Settings
        </h1>
      </div>

      <div className="rounded-xl p-6 mb-4" style={{ background:'rgba(15,23,42,0.50)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'0.75rem', boxShadow:'0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
            style={{
              background: SELF_AVATAR_COLOR,
              color: 'var(--text-on-amber, #0A0F1E)',
              border: '2px solid rgba(255,255,255,0.20)',
            }}
          >
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
              <Input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="text-[13px] flex-1"
              />
              <Button variant="ghost" size="sm" onClick={handleSaveName}>
                {saved ? 'Saved' : 'Save'}
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-white/50 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <div
              className="rounded-lg px-3 py-2 text-[13px] cursor-not-allowed"
              style={readonlyField}
            >
              {user?.email}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-white/50 uppercase tracking-wider mb-1.5">
              Role
            </label>
            <div
              className="rounded-lg px-3 py-2 text-[13px] cursor-not-allowed"
              style={readonlyField}
            >
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
              <p className="text-[13px] text-[rgba(255,255,255,0.74)]">Active Sessions</p>
              <p className="text-[11px] text-white/40 mt-0.5">
                {sessionData?.total ?? 0} sessions
              </p>
            </div>
            <button
              onClick={() => forceLogout.mutate()}
              disabled={forceLogout.isPending}
              className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider touch-target"
              style={{
                background: 'transparent',
                border: '1px solid var(--sev-critical-border)',
                color: 'var(--sev-critical)',
                transition: 'var(--transition-fast)',
              }}
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

      {/* ─── Passkeys ───────────────────────────── */}
      <PasskeysCard
        supported={passkeySupported}
        passkeys={passkeys ?? []}
        busy={passkeyBusy}
        error={passkeyError}
        onAdd={handleAddPasskey}
        onRemove={handleRemovePasskey}
      />

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
              {['Dark', 'Light', 'System'].map(theme => {
                const active = theme === 'Dark';
                return (
                  <button
                    key={theme}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wider touch-target"
                    style={{
                      background: active ? 'var(--amber-glow)' : 'var(--bg-input)',
                      border: `1px solid ${active ? 'var(--amber-border)' : 'var(--border-base)'}`,
                      color: active ? 'var(--amber)' : 'var(--text-tertiary)',
                      transition: 'var(--transition-fast)',
                    }}
                  >
                    {theme}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-white/50 uppercase tracking-wider mb-1.5">
              Timezone
            </label>
            <div
              className="rounded-lg px-3 py-2 text-[13px]"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-base)',
                color: 'var(--text-secondary)',
              }}
            >
              {Intl.DateTimeFormat().resolvedOptions().timeZone} (auto-detected)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Passkeys section ────────────────────────────────────────────────

interface PasskeysCardProps {
  supported: boolean;
  passkeys: PasskeyDevice[];
  busy: boolean;
  error: string | null;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

function PasskeysCard({ supported, passkeys, busy, error, onAdd, onRemove }: PasskeysCardProps) {
  const cardStyle: React.CSSProperties = {
    background: 'rgba(15,23,42,0.50)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '0.75rem',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
  };

  return (
    <div className="rounded-xl p-5 mb-4" style={cardStyle}>
      <div className="flex items-center gap-2 mb-4">
        <Key size={14} style={{ color: 'var(--amber)' }} />
        <span className="section-label">Passkeys</span>
      </div>

      {!supported ? (
        <p className="text-[12px] text-white/55">
          Your browser doesn't support passkeys. Try Safari 16+, Chrome 108+, or Firefox 122+.
        </p>
      ) : (
        <>
          <p className="text-[12px] text-white/55 mb-3">
            Sign in with Touch ID, Face ID, or a security key — no password to remember.
            Adding a passkey on this device makes future sign-ins one tap.
          </p>

          {passkeys.length > 0 && (
            <div className="space-y-1 mb-3">
              {passkeys.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 px-1 border-b border-white/5 last:border-0">
                  <div className="min-w-0">
                    <p className="text-[13px] text-[rgba(255,255,255,0.74)] truncate">
                      {p.device_label || 'Unknown device'}
                      {p.backed_up ? <span className="ml-2 text-[10px] text-white/40">·  synced</span> : null}
                    </p>
                    <p className="text-[10px] text-white/40 truncate font-mono">
                      Added {new Date(p.created_at).toLocaleDateString()}
                      {p.last_used_at ? ` · last used ${new Date(p.last_used_at).toLocaleDateString()}` : ' · never used'}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemove(p.id)}
                    className="p-1.5 rounded touch-target ml-3"
                    style={{ color: 'rgba(248,113,113,0.7)' }}
                    aria-label="Remove passkey"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={onAdd}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-[13px] font-medium transition-colors disabled:opacity-50"
            style={{
              background: 'rgba(229,168,50,0.10)',
              border: '1px solid rgba(229,168,50,0.30)',
              color: 'var(--amber)',
            }}
          >
            <Plus className="w-4 h-4" />
            {busy ? 'Adding…' : passkeys.length === 0 ? 'Set up a passkey' : 'Add another passkey'}
          </button>
          {error && <p className="text-[11px] mt-2" style={{ color: '#f87171' }}>{error}</p>}
        </>
      )}
    </div>
  );
}
