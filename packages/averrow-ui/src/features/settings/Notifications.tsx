// Stub for /v2/notifications. PR 4 of the notifications/alerts audit
// replaces this with a paginated archive (filter by type/severity,
// search, mark-as-read inline). PR 2 just brings the header + stub
// card into design-system parity so it doesn't visually clash with
// the Profile + NotificationPreferences pages around it.

import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/design-system/components';

export function Notifications() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto page-enter">
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
          All Notifications
        </h1>
      </div>

      <Card>
        <div className="py-12 text-center">
          <p className="text-[13px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
            Full notification archive coming in PR 4.
          </p>
          <p className="text-[11px] font-mono mt-2" style={{ color: 'var(--text-tertiary)' }}>
            Use the bell icon for recent notifications.
          </p>
        </div>
      </Card>
    </div>
  );
}
