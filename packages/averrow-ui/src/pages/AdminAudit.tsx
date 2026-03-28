import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';

export function AdminAudit() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/v1/audit-log?limit=1')
      .then(r => r.json())
      .then(d => setCount(d.total ?? 0))
      .catch(() => setCount(null));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-parchment font-display">Audit Log</h1>
        <p className="text-sm text-contrail/50 font-mono mt-1">Platform activity trail</p>
      </div>

      <Card hover={false}>
        <SectionLabel className="mb-2">Events Recorded</SectionLabel>
        <div className="text-2xl font-bold text-parchment font-display">
          {count !== null ? count.toLocaleString() : '—'}
        </div>
      </Card>

      <Card hover={false}>
        <SectionLabel className="mb-3">Audit Trail</SectionLabel>
        <p className="text-sm text-contrail/40">
          Full audit log viewer with filtering and export coming soon.
        </p>
      </Card>
    </div>
  );
}
