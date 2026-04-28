import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BellRing, BellOff, Smartphone, Trash2, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  USER_TOGGLEABLE_EVENTS,
  NOTIFICATION_CHANNELS,
} from '@averrow/shared';
import { Card, SectionLabel } from '@/design-system/components';
import {
  getPushStatus, subscribePush, unsubscribePush,
  listPushDevices, removePushDevice,
  type PushStatus, type PushDevice,
} from '@/lib/push';

const PREF_KEYS = [
  ...USER_TOGGLEABLE_EVENTS.map((e) => e.key),
  ...NOTIFICATION_CHANNELS.map((c) => c.key),
] as const;
type PrefKey = (typeof PREF_KEYS)[number];
type Preferences = Record<PrefKey, boolean>;

interface PreferencesResponse extends Preferences {
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_tz: string | null;
  critical_breakthrough: boolean;
}

const PREF_DEFAULTS: Preferences = (() => {
  const out = {} as Preferences;
  for (const e of USER_TOGGLEABLE_EVENTS) out[e.key] = e.defaultEnabled;
  for (const c of NOTIFICATION_CHANNELS) out[c.key] = c.defaultEnabled;
  return out;
})();

const FULL_DEFAULTS: PreferencesResponse = {
  ...PREF_DEFAULTS,
  quiet_hours_start: null,
  quiet_hours_end: null,
  quiet_hours_tz: null,
  critical_breakthrough: false,
};

const DEFAULT_TZ = typeof Intl !== 'undefined'
  ? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  : 'UTC';

export function NotificationPreferences() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const res = await api.get<PreferencesResponse>('/api/notifications/preferences');
      return res.data ?? FULL_DEFAULTS;
    },
  });

  const [localPrefs, setLocalPrefs] = useState<PreferencesResponse | null>(null);
  const currentPrefs = localPrefs ?? prefs;

  const updatePrefs = useMutation({
    mutationFn: async (updated: Partial<PreferencesResponse>) => {
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
    updatePrefs.mutate({ [key]: updated[key] } as Partial<PreferencesResponse>);
  };

  const handleQuietField = <K extends 'quiet_hours_start' | 'quiet_hours_end' | 'quiet_hours_tz' | 'critical_breakthrough'>(
    key: K,
    value: PreferencesResponse[K],
  ) => {
    if (!currentPrefs) return;
    const updated = { ...currentPrefs, [key]: value };
    setLocalPrefs(updated);
    updatePrefs.mutate({ [key]: value } as Partial<PreferencesResponse>);
  };

  // ─── Push subscription state ───────────────────────────────────────
  const { data: pushStatus, refetch: refetchPushStatus } = useQuery({
    queryKey: ['push-status'],
    queryFn: getPushStatus,
  });

  const { data: pushDevices } = useQuery({
    queryKey: ['push-devices'],
    queryFn: listPushDevices,
    enabled: pushStatus?.subscribed === true,
  });

  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  const handleEnablePush = async () => {
    setPushBusy(true); setPushError(null);
    try {
      await subscribePush();
      await refetchPushStatus();
      queryClient.invalidateQueries({ queryKey: ['push-devices'] });
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Failed to enable push notifications.');
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    setPushBusy(true); setPushError(null);
    try {
      await unsubscribePush();
      await refetchPushStatus();
      queryClient.invalidateQueries({ queryKey: ['push-devices'] });
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Failed to disable push notifications.');
    } finally {
      setPushBusy(false);
    }
  };

  const handleRemoveDevice = async (id: string) => {
    try {
      await removePushDevice(id);
      queryClient.invalidateQueries({ queryKey: ['push-devices'] });
      await refetchPushStatus();
    } catch { /* swallow */ }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border-base)',
    color: 'var(--text-primary)',
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
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="font-mono text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: 'var(--text-muted)' }}>
          Notification Preferences
        </h1>
      </div>

      {/* ─── Alert Types ─────────────────────────────────────────── */}
      <Card className="mb-4">
        <SectionLabel className="mb-3">Alert Types</SectionLabel>
        <div className="space-y-1">
          {USER_TOGGLEABLE_EVENTS.map(({ key, label, description }) => (
            <button
              key={key}
              onClick={() => handleToggle(key)}
              className="w-full flex items-center justify-between py-3 px-1 border-b border-white/5 last:border-0 touch-target"
            >
              <div>
                <p className="text-[13px] text-left" style={{ color: 'var(--text-primary)' }}>{label}</p>
                <p className="text-[11px] text-left mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
              </div>
              <Toggle on={currentPrefs?.[key] === true} />
            </button>
          ))}
        </div>
      </Card>

      {/* ─── Push Notifications ──────────────────────────────────── */}
      <PushSection
        status={pushStatus}
        busy={pushBusy}
        error={pushError}
        devices={pushDevices ?? []}
        onEnable={handleEnablePush}
        onDisable={handleDisablePush}
        onRemoveDevice={handleRemoveDevice}
      />

      {/* ─── Quiet Hours ─────────────────────────────────────────── */}
      <Card className="mb-4">
        <SectionLabel className="mb-3">Quiet Hours</SectionLabel>
        <p className="text-[11px] mb-3" style={{ color: 'var(--text-secondary)' }}>
          Suppress push notifications during these hours. The bell icon and
          notification feed still update — only the OS push delivery is
          silenced.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Start</span>
            <input
              type="time"
              value={currentPrefs?.quiet_hours_start ?? ''}
              onChange={(e) => handleQuietField('quiet_hours_start', e.target.value || null)}
              className="mt-1 w-full px-3 py-2 rounded-md text-[13px]"
              style={inputStyle}
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>End</span>
            <input
              type="time"
              value={currentPrefs?.quiet_hours_end ?? ''}
              onChange={(e) => handleQuietField('quiet_hours_end', e.target.value || null)}
              className="mt-1 w-full px-3 py-2 rounded-md text-[13px]"
              style={inputStyle}
            />
          </label>
        </div>

        <label className="block mb-3">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Timezone</span>
          <input
            type="text"
            value={currentPrefs?.quiet_hours_tz ?? ''}
            placeholder={DEFAULT_TZ}
            onChange={(e) => handleQuietField('quiet_hours_tz', e.target.value || null)}
            onBlur={(e) => {
              // If the user leaves it blank but has set a window, pre-fill with their browser tz.
              if (!e.target.value && (currentPrefs?.quiet_hours_start || currentPrefs?.quiet_hours_end)) {
                handleQuietField('quiet_hours_tz', DEFAULT_TZ);
              }
            }}
            className="mt-1 w-full px-3 py-2 rounded-md text-[13px] font-mono"
            style={inputStyle}
          />
        </label>

        <button
          onClick={() => handleQuietField('critical_breakthrough', !currentPrefs?.critical_breakthrough)}
          className="w-full flex items-center justify-between py-3 px-1 touch-target"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--sev-critical)' }} />
            <div>
              <p className="text-[13px] text-left" style={{ color: 'var(--text-primary)' }}>Critical Breakthrough</p>
              <p className="text-[11px] text-left mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                Allow critical severity events to break through quiet hours
              </p>
            </div>
          </div>
          <Toggle on={currentPrefs?.critical_breakthrough === true} />
        </button>
      </Card>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function Toggle({ on }: { on: boolean }) {
  return (
    <div className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ml-3 flex items-center ${
      on ? 'bg-afterburner/30' : 'bg-white/10'
    }`}>
      <div className={`w-4 h-4 rounded-full transition-transform ${
        on ? 'translate-x-[18px] bg-afterburner' : 'translate-x-[2px] bg-white/30'
      }`} />
    </div>
  );
}

interface PushSectionProps {
  status: PushStatus | undefined;
  busy: boolean;
  error: string | null;
  devices: PushDevice[];
  onEnable: () => void;
  onDisable: () => void;
  onRemoveDevice: (id: string) => void;
}

function PushSection(props: PushSectionProps) {
  const { status, busy, error, devices, onEnable, onDisable, onRemoveDevice } = props;

  return (
    <Card className="mb-4">
      <SectionLabel className="mb-3">Push Notifications</SectionLabel>

      {status === undefined ? (
        <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Checking browser support…</p>
      ) : !status.supported ? (
        <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          Your browser doesn't support Web Push. Try Safari 16.4+, Chrome, or Firefox.
        </p>
      ) : status.needsInstall ? (
        <div
          className="p-3 rounded-md"
          style={{
            background: 'var(--sev-medium-bg)',
            border: '1px solid var(--sev-medium-border)',
          }}
        >
          <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>
            <strong>Install required.</strong> On iOS, add Averrow to your home screen first:
            tap <span className="font-mono">Share</span> → <span className="font-mono">Add to Home Screen</span>,
            then re-open from the home-screen icon and come back here.
          </p>
        </div>
      ) : status.permission === 'denied' ? (
        <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          Notification permission was denied. Re-enable it in your browser's site settings, then refresh.
        </p>
      ) : (
        <div>
          <button
            onClick={status.subscribed ? onDisable : onEnable}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-[13px] font-medium transition-colors disabled:opacity-50"
            style={{
              background: status.subscribed ? 'var(--sev-critical-bg)' : 'var(--green-glow)',
              border: `1px solid ${status.subscribed ? 'var(--sev-critical-border)' : 'var(--green-border)'}`,
              color: status.subscribed ? 'var(--sev-critical)' : 'var(--green)',
            }}
          >
            {status.subscribed ? <BellOff className="w-4 h-4" /> : <BellRing className="w-4 h-4" />}
            {busy
              ? 'Working…'
              : status.subscribed
                ? 'Disable Push Notifications'
                : 'Enable Push Notifications'}
          </button>
          {error && (
            <p className="text-[11px] mt-2" style={{ color: 'var(--sev-critical)' }}>{error}</p>
          )}
        </div>
      )}

      {status?.subscribed && devices.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Devices</span>
          <div className="mt-2 space-y-1">
            {devices.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2 px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Smartphone className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                  <div className="min-w-0">
                    <p className="text-[13px] truncate" style={{ color: 'var(--text-primary)' }}>{d.device_label || 'Unknown device'}</p>
                    <p className="text-[10px] truncate font-mono" style={{ color: 'var(--text-tertiary)' }}>
                      Added {new Date(d.created_at).toLocaleDateString()}
                      {d.last_used_at ? ` · last push ${new Date(d.last_used_at).toLocaleDateString()}` : ' · never used'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveDevice(d.id)}
                  className="p-1.5 rounded touch-target"
                  style={{ color: 'var(--sev-critical)', opacity: 0.7 }}
                  aria-label="Remove device"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
