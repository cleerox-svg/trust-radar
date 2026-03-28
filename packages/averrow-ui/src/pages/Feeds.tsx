import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';

interface FeedConfig {
  id: number;
  display_name: string;
  enabled: boolean;
  schedule_cron: string;
  last_pull?: string;
}

export function Feeds() {
  const [feeds, setFeeds] = useState<FeedConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/feeds')
      .then(r => r.json())
      .then(d => setFeeds(d.data ?? d.feeds ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-parchment font-display">Feeds</h1>
        <p className="text-sm text-contrail/50 font-mono mt-1">
          {feeds.length > 0 ? `${feeds.length} feed configurations` : 'Threat intelligence feed sources'}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} hover={false}>
              <div className="h-16 animate-pulse bg-white/5 rounded" />
            </Card>
          ))}
        </div>
      ) : feeds.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {feeds.map(feed => (
            <Card key={feed.id} hover={false}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${feed.enabled ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-sm font-semibold text-parchment truncate">{feed.display_name}</span>
              </div>
              <div className="text-xs text-contrail/50 font-mono space-y-1">
                <div>Schedule: {feed.schedule_cron}</div>
                {feed.last_pull && <div>Last pull: {feed.last_pull}</div>}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card hover={false}>
          <SectionLabel className="mb-3">Feed Sources</SectionLabel>
          <p className="text-sm text-contrail/40">
            Feed configuration data will appear here once connected to the backend.
          </p>
        </Card>
      )}
    </div>
  );
}
