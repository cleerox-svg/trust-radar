import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';

export function Alerts() {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/v1/alerts?status=open&limit=1')
      .then(r => r.json())
      .then(d => setTotal(d.total ?? 0))
      .catch(() => setTotal(0));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-parchment font-display">Alerts</h1>
        <p className="text-sm text-contrail/50 font-mono mt-1">Active contacts requiring attention</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card hover={false}>
          <SectionLabel className="mb-2">Open Alerts</SectionLabel>
          <div className="text-2xl font-bold text-parchment font-display">
            {total !== null ? total : '—'}
          </div>
        </Card>
        <Card hover={false}>
          <SectionLabel className="mb-2">Status</SectionLabel>
          <div className="text-sm text-contrail/60 font-mono">Monitoring</div>
        </Card>
        <Card hover={false}>
          <SectionLabel className="mb-2">Last Check</SectionLabel>
          <div className="text-sm text-contrail/60 font-mono">Just now</div>
        </Card>
      </div>

      <Card hover={false}>
        <SectionLabel className="mb-3">Alert Management</SectionLabel>
        <p className="text-sm text-contrail/40">
          Full alert management with triage, assignment, and escalation coming soon.
        </p>
      </Card>
    </div>
  );
}
