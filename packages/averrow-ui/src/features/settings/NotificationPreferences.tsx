import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Preferences {
  brand_threat: boolean;
  campaign_escalation: boolean;
  feed_health: boolean;
  intelligence_digest: boolean;
  agent_milestone: boolean;
  browser_notifications: boolean;
  push_notifications: boolean;
}

const PREF_LABELS: Record<keyof Preferences, string> = {
  brand_threat: 'Brand Threats',
  campaign_escalation: 'Campaign Escalations',
  feed_health: 'Feed Health Alerts',
  intelligence_digest: 'Intelligence Digests',
  agent_milestone: 'Agent Milestones',
  browser_notifications: 'Browser Notifications',
  push_notifications: 'Push Notifications',
};

const PREF_DESCRIPTIONS: Record<keyof Preferences, string> = {
  brand_threat: 'New threats targeting your monitored brands',
  campaign_escalation: 'When campaigns escalate in severity',
  feed_health: 'Feed degradation and health warnings',
  intelligence_digest: 'Daily and weekly intelligence summaries',
  agent_milestone: 'Agent completion and milestone events',
  browser_notifications: 'Show browser push notifications',
  push_notifications: 'Mobile push notifications',
};

export function NotificationPreferences() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const res = await api.get<Preferences>('/api/notifications/preferences');
      return res.data ?? {
        brand_threat: true,
        campaign_escalation: true,
        feed_health: true,
        intelligence_digest: true,
        agent_milestone: true,
        browser_notifications: false,
        push_notifications: false,
      };
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
          className="glass-btn p-2 rounded-lg touch-target"
        >
          <ArrowLeft className="w-4 h-4 text-white/60" />
        </button>
        <h1 className="font-mono text-[10px] uppercase tracking-[0.15em] text-contrail/70 font-bold">
          Notification Preferences
        </h1>
      </div>

      <div className="glass-card-amber rounded-xl p-5 mb-4" style={{ background:'rgba(15,23,42,0.50)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'0.75rem', boxShadow:'0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        <span className="section-label">Alert Types</span>
        <div className="mt-3 space-y-1">
          {(['brand_threat', 'campaign_escalation', 'feed_health', 'intelligence_digest', 'agent_milestone'] as const).map(key => (
            <button
              key={key}
              onClick={() => handleToggle(key)}
              className="w-full flex items-center justify-between py-3 px-1 border-b border-white/5 last:border-0 touch-target"
            >
              <div>
                <p className="text-[13px] text-parchment/80 text-left">{PREF_LABELS[key]}</p>
                <p className="text-[11px] text-white/50 text-left mt-0.5">{PREF_DESCRIPTIONS[key]}</p>
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
          {(['browser_notifications', 'push_notifications'] as const).map(key => (
            <button
              key={key}
              onClick={() => handleToggle(key)}
              className="w-full flex items-center justify-between py-3 px-1 border-b border-white/5 last:border-0 touch-target"
            >
              <div>
                <p className="text-[13px] text-parchment/80 text-left">{PREF_LABELS[key]}</p>
                <p className="text-[11px] text-white/50 text-left mt-0.5">{PREF_DESCRIPTIONS[key]}</p>
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
