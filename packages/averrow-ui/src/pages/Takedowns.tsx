import { useState } from 'react';
import { useAdminTakedowns, useTakedownEvidence, useUpdateTakedown } from '@/hooks/useTakedowns';
import type { Takedown } from '@/hooks/useTakedowns';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { TableLoader } from '@/components/ui/PageLoader';
import { useToast } from '@/components/ui/Toast';
import { relativeTime } from '@/lib/time';

const STATUS_ORDER = ['all', 'requested', 'submitted', 'pending_response', 'draft', 'taken_down', 'failed'] as const;

function severityDot(severity: string) {
  const colors: Record<string, string> = {
    critical: 'bg-accent',
    high: 'bg-warning',
    medium: 'bg-yellow-400',
    low: 'bg-contrail',
  };
  return colors[severity] || 'bg-contrail/40';
}

function statusLabel(s: string) {
  return s.replace(/_/g, ' ');
}

function TakedownActions({ takedown, onUpdate }: { takedown: Takedown; onUpdate: (id: string, status: string) => void }) {
  const s = takedown.status;

  if (s === 'draft') return (
    <div className="flex gap-2">
      <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); onUpdate(takedown.id, 'submitted'); }}>SUBMIT</Button>
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onUpdate(takedown.id, 'withdrawn'); }}>WITHDRAW</Button>
    </div>
  );

  if (s === 'requested') return (
    <div className="flex gap-2">
      <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); onUpdate(takedown.id, 'submitted'); }}>SUBMIT TO PROVIDER</Button>
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onUpdate(takedown.id, 'failed'); }}>REJECT</Button>
    </div>
  );

  if (s === 'submitted') return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); onUpdate(takedown.id, 'pending_response'); }}>PENDING</Button>
      <Button variant="success" size="sm" onClick={(e) => { e.stopPropagation(); onUpdate(takedown.id, 'taken_down'); }}>TAKEN DOWN</Button>
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onUpdate(takedown.id, 'failed'); }}>FAILED</Button>
    </div>
  );

  if (s === 'pending_response') return (
    <div className="flex gap-2">
      <Button variant="success" size="sm" onClick={(e) => { e.stopPropagation(); onUpdate(takedown.id, 'taken_down'); }}>TAKEN DOWN</Button>
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onUpdate(takedown.id, 'failed'); }}>FAILED</Button>
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onUpdate(takedown.id, 'expired'); }}>EXPIRED</Button>
    </div>
  );

  if (s === 'taken_down') return <Badge variant="success">✓ RESOLVED</Badge>;

  return <Badge variant="default">{statusLabel(s)}</Badge>;
}

function EvidencePanel({ takedownId }: { takedownId: string }) {
  const { data: evidence, isLoading } = useTakedownEvidence(takedownId);

  if (isLoading) return <Skeleton className="h-20 rounded-lg mt-3" />;
  if (!evidence?.length) return <p className="text-xs text-contrail/40 mt-3">No evidence artifacts found.</p>;

  return (
    <div className="mt-3 space-y-2">
      {evidence.map(e => (
        <div key={e.id} className="bg-cockpit rounded-lg p-3 border border-white/[0.04]">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="info">{e.evidence_type}</Badge>
            <span className="font-mono text-xs font-semibold text-parchment">{e.title}</span>
          </div>
          {e.content_text && (
            <p className="text-xs text-contrail/60 line-clamp-4">{e.content_text}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function Takedowns() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: res, isLoading } = useAdminTakedowns({
    status: statusFilter === 'all' ? undefined : statusFilter,
    severity: severityFilter || undefined,
  });
  const updateTakedown = useUpdateTakedown();
  const { showToast } = useToast();

  const takedowns = res || [];

  const statusCounts: Record<string, number> = {};
  takedowns.forEach(t => {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
  });

  const tabs = STATUS_ORDER.map(s => ({
    id: s,
    label: s === 'all' ? 'All' : statusLabel(s).toUpperCase(),
    count: s === 'all' ? takedowns.length : statusCounts[s],
  }));

  const handleUpdate = (id: string, status: string) => {
    updateTakedown.mutate({ id, status }, {
      onSuccess: () => showToast('Takedown status updated', 'success'),
      onError: () => showToast('Failed to update takedown', 'error'),
    });
  };

  if (isLoading) return <TableLoader rows={6} />;

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="font-display text-xl font-bold text-parchment">SOC Takedown Queue</h1>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Tabs tabs={tabs} activeTab={statusFilter} onChange={setStatusFilter} />
        <Select
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}
          options={[
            { value: '', label: 'All Severities' },
            { value: 'critical', label: 'Critical' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {takedowns.map(td => (
            <Card
              key={td.id}
              hover
              className="cursor-pointer"
            >
              <div onClick={() => setExpandedId(expandedId === td.id ? null : td.id)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${severityDot(td.severity)}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-sm text-parchment truncate">{td.target_value}</span>
                        <Badge variant="info">{td.target_type}</Badge>
                        <span className="font-mono text-xs text-contrail/40">{statusLabel(td.status)}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {td.brand_name && <span className="text-xs text-contrail/50">{td.brand_name}</span>}
                        {td.provider_name && <span className="text-xs text-contrail/40">via {td.provider_name}</span>}
                        {td.provider_abuse_contact && (
                          <a
                            href={`mailto:${td.provider_abuse_contact}`}
                            className="text-xs text-accent hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            {td.provider_abuse_contact}
                          </a>
                        )}
                        {!td.requested_by && td.source_type && (
                          <Badge variant="high">SPARROW</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-mono text-xs text-contrail/40">{relativeTime(td.created_at)}</span>
                    <TakedownActions takedown={td} onUpdate={handleUpdate} />
                  </div>
                </div>

                {expandedId === td.id && (
                  <div className="mt-4 pt-3 border-t border-white/[0.04] space-y-2">
                    <p className="text-sm text-parchment/70">{td.evidence_summary}</p>
                    {td.evidence_detail && (
                      <p className="text-xs text-contrail/50 whitespace-pre-line">{td.evidence_detail}</p>
                    )}
                    {td.target_url && (
                      <div className="font-mono text-xs text-contrail/40">
                        Target: <span className="text-accent">{td.target_url}</span>
                      </div>
                    )}
                    <EvidencePanel takedownId={td.id} />
                  </div>
                )}
              </div>
            </Card>
          ))}
          {takedowns.length === 0 && (
            <Card hover={false}>
              <p className="text-sm text-contrail/40 text-center py-4">No takedowns match the current filters.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
