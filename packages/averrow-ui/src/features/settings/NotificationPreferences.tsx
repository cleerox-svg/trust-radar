import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  USER_TOGGLEABLE_EVENTS,
  NOTIFICATION_CHANNELS,
} from '@/lib/notification-events';

// All user-facing pref keys (events + channels). Both halves of the matrix
// derive from the registry, so adding a new toggleable event there auto-
// renders here and the API contract stays consistent with the worker.
const PREF_KEYS = [
  ...USER_TOGGLEABLE_EVENTS.map((e) => e.key),
  ...NOTIFICATION_CHANNELS.map((c) => c.key),
] as const;
type PrefKey = (typeof PREF_KEYS)[number];
type Preferences = Record<PrefKey, boolean>;

const PREF_DEFAULTS: Preferences = (() => {
  const out = {} as Preferences;
  for (const e of USER_TOGGLEABLE_EVENTS) out[e.key] = e.defaultEnabled;
  for (const c of NOTIFICATION_CHANNELS) out[c.key] = c.defaultEnabled;
  return out;
})();

export function NotificationPreferences() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const res = await api.get<Preferences>('/api/notifications/preferences');
      return res.data ?? { ...PREF_DEFAULTS };
    },
  });

  const [localPrefs, setLocalPrefs] = useState<Preferences | null>(null);
  const currentPrefs = localPrefs ?? prefs;

  const updatePrefs = useMutation({
    mutationFn: async (updated: Preferences) => {
      await api.patch('/api/notifications/preferences', updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });

  const handleToggle = (key: keyof Preferences) => {
    if (!currentPrefs) return;
    const updated = { ...currentPrefs, [key]: !currentPrefs[key] };
    setLocalPrefs(updated);
    updatePrefs.mutate(updated);
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
          Notification Preferences
        </h1>
      </div>

      <div className="rounded-xl p-5 mb-4" style={{ background:'rgba(15,23,42,0.50)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'0.75rem', boxShadow:'0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        <span className="section-label">Alert Types</span>
        <div className="mt-3 space-y-1">
          {USER_TOGGLEABLE_EVENTS.map(({ key, label, description }) => (
            <button
              key={key}
              onClick={() => handleToggle(key)}
              className="w-full flex items-center justify-between py-3 px-1 border-b border-white/5 last:border-0 touch-target"
            >
              <div>
                <p className="text-[13px] text-[rgba(255,255,255,0.74)] text-left">{label}</p>
                <p className="text-[11px] text-white/50 text-left mt-0.5">{description}</p>
              </div>
              <div className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ml-3 flex items-center ${
                currentPrefs?.[key] ? 'bg-afterburner/30' : 'bg-white/10'
              }`}>
                <div className={`w-4 h-4 rounded-full transition-transform ${
                  currentPrefs?.[key]
                    ? 'translate-x-[18px] bg-afterburner'
                    : 'translate-x-[2px] bg-white/30'
                }`} />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background:'rgba(15,23,42,0.50)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'0.75rem', boxShadow:'0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        <span className="section-label">Delivery</span>
        <div className="mt-3 space-y-1">
          {NOTIFICATION_CHANNELS.map(({ key, label, description }) => (
            <button
              key={key}
              onClick={() => handleToggle(key)}
              className="w-full flex items-center justify-between py-3 px-1 border-b border-white/5 last:border-0 touch-target"
            >
              <div>
                <p className="text-[13px] text-[rgba(255,255,255,0.74)] text-left">{label}</p>
                <p className="text-[11px] text-white/50 text-left mt-0.5">{description}</p>
              </div>
              <div className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ml-3 flex items-center ${
                currentPrefs?.[key] ? 'bg-afterburner/30' : 'bg-white/10'
              }`}>
                <div className={`w-4 h-4 rounded-full transition-transform ${
                  currentPrefs?.[key]
                    ? 'translate-x-[18px] bg-afterburner'
                    : 'translate-x-[2px] bg-white/30'
                }`} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
