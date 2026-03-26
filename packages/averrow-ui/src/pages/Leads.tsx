import { useState } from 'react';
import { useLeads, useLeadStats, useEnrichLead } from '@/hooks/useLeads';
import type { SalesLead } from '@/hooks/useLeads';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Table, Th, Td } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { TableLoader } from '@/components/ui/PageLoader';
import { useToast } from '@/components/ui/Toast';
import { relativeTime } from '@/lib/time';

const KANBAN_COLUMNS = ['new', 'contacted', 'qualified', 'proposal_sent', 'converted', 'closed_lost'] as const;
const PIPELINE_STATUSES = ['new', 'researched', 'drafted', 'approved', 'sent', 'replied', 'meeting', 'converted'] as const;

function columnLabel(s: string) {
  return s.replace(/_/g, ' ').toUpperCase();
}

function gradeVariant(grade: string | null): 'success' | 'info' | 'medium' | 'critical' | 'default' {
  if (!grade) return 'default';
  const g = grade.toUpperCase();
  if (g === 'A+' || g === 'A') return 'success';
  if (g === 'B+' || g === 'B') return 'info';
  if (g === 'C+' || g === 'C') return 'medium';
  return 'critical';
}

function KanbanView({ leads }: { leads: SalesLead[] }) {
  const grouped = KANBAN_COLUMNS.reduce<Record<string, SalesLead[]>>((acc, col) => {
    acc[col] = leads.filter(l => l.status === col);
    return acc;
  }, {} as Record<string, SalesLead[]>);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map(col => (
        <div key={col} className="min-w-[260px] flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <SectionLabel>{columnLabel(col)}</SectionLabel>
            <Badge variant="info">{grouped[col]?.length ?? 0}</Badge>
          </div>
          <div className="space-y-3">
            {(grouped[col] || []).map(lead => (
              <Card key={lead.id} className="space-y-2">
                <div className="font-display font-semibold text-sm text-parchment truncate">
                  {lead.company_name ?? 'Unknown'}
                </div>
                <div className="font-mono text-xs text-contrail/40">{lead.company_domain ?? '—'}</div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-parchment">{lead.prospect_score}</span>
                  {lead.pitch_angle && <Badge variant="info">{lead.pitch_angle}</Badge>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PipelineView({ leads, stats }: { leads: SalesLead[]; stats: ReturnType<typeof useLeadStats>['data'] }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [pitchFilter, setPitchFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = leads.filter(l => {
    if (statusFilter && l.status !== statusFilter) return false;
    if (pitchFilter && l.pitch_angle !== pitchFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (l.company_name?.toLowerCase().includes(q) || l.company_domain?.toLowerCase().includes(q));
    }
    return true;
  });

  const pitchAngles = [...new Set(leads.map(l => l.pitch_angle).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {PIPELINE_STATUSES.map(s => (
              <div key={s} className="bg-instrument border border-white/[0.06] rounded-lg p-3 text-center">
                <div className="font-display text-lg font-bold text-parchment">{stats[s as keyof typeof stats] ?? 0}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-contrail/50">{s}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-contrail/50">Response Rate</span>
                <span className="font-mono text-xs text-parchment">{(stats.response_rate * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded overflow-hidden">
                <div className="h-full bg-positive rounded" style={{ width: `${stats.response_rate * 100}%` }} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-contrail/50">Conversion Rate</span>
                <span className="font-mono text-xs text-parchment">{(stats.conversion_rate * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded overflow-hidden">
                <div className="h-full bg-accent rounded" style={{ width: `${stats.conversion_rate * 100}%` }} />
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          options={[
            { value: '', label: 'All Statuses' },
            ...PIPELINE_STATUSES.map(s => ({ value: s, label: columnLabel(s) })),
          ]}
        />
        <Select
          value={pitchFilter}
          onChange={e => setPitchFilter(e.target.value)}
          options={[
            { value: '', label: 'All Pitch Angles' },
            ...pitchAngles.map(p => ({ value: p, label: p })),
          ]}
        />
        <Input
          placeholder="Search companies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-56"
        />
      </div>

      <Card hover={false} className="p-0 overflow-hidden">
        <Table>
          <thead>
            <tr>
              <Th>Company</Th>
              <Th>Domain</Th>
              <Th>Score</Th>
              <Th>Pitch Angle</Th>
              <Th>Email Grade</Th>
              <Th>Threats</Th>
              <Th>Status</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(lead => (
              <>
                <tr
                  key={lead.id}
                  className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                  onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                >
                  <Td><span className="font-display font-semibold text-sm text-parchment">{lead.company_name ?? '—'}</span></Td>
                  <Td><span className="font-mono text-xs text-contrail/60">{lead.company_domain ?? '—'}</span></Td>
                  <Td><span className="font-mono text-sm font-bold text-parchment">{lead.prospect_score}</span></Td>
                  <Td>{lead.pitch_angle ? <Badge variant="info">{lead.pitch_angle}</Badge> : '—'}</Td>
                  <Td>{lead.email_security_grade ? <Badge variant={gradeVariant(lead.email_security_grade)}>{lead.email_security_grade}</Badge> : '—'}</Td>
                  <Td><span className="font-mono text-sm">{lead.threat_count_30d ?? 0}</span></Td>
                  <Td><Badge variant="default">{columnLabel(lead.status)}</Badge></Td>
                  <Td><span className="font-mono text-xs text-contrail/40">{relativeTime(lead.created_at)}</span></Td>
                </tr>
                {expandedId === lead.id && (
                  <tr key={`${lead.id}-detail`}>
                    <td colSpan={8} className="px-3 pb-4">
                      <div className="mt-2 space-y-3 bg-cockpit rounded-lg p-4 border border-white/[0.04]">
                        {lead.findings_summary && (
                          <div>
                            <SectionLabel className="mb-1">Findings</SectionLabel>
                            <p className="text-sm text-parchment/70">{lead.findings_summary}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {lead.outreach_variant_1 && (
                            <div>
                              <span className="font-mono text-[10px] text-contrail/40 uppercase">Outreach Variant 1</span>
                              <p className="text-xs text-contrail/60 mt-1 whitespace-pre-line">{lead.outreach_variant_1}</p>
                            </div>
                          )}
                          {lead.outreach_variant_2 && (
                            <div>
                              <span className="font-mono text-[10px] text-contrail/40 uppercase">Outreach Variant 2</span>
                              <p className="text-xs text-contrail/60 mt-1 whitespace-pre-line">{lead.outreach_variant_2}</p>
                            </div>
                          )}
                        </div>
                        <Badge variant={lead.ai_enriched ? 'success' : 'default'}>
                          {lead.ai_enriched ? 'AI ENRICHED' : 'NOT ENRICHED'}
                        </Badge>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </Table>
        {filtered.length === 0 && (
          <p className="text-sm text-contrail/40 text-center py-8">No leads match the current filters.</p>
        )}
      </Card>
    </div>
  );
}

export function Leads() {
  const [activeView, setActiveView] = useState<'kanban' | 'pipeline'>('kanban');
  const { data: leadsRes, isLoading } = useLeads();
  const { data: stats } = useLeadStats();
  const enrichLead = useEnrichLead();
  const { showToast } = useToast();

  const leads = leadsRes?.data || [];

  if (isLoading) return <TableLoader rows={8} />;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-parchment">Lead Management</h1>
        <div className="flex gap-2">
          <Button
            variant={activeView === 'kanban' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveView('kanban')}
          >
            Scan Leads
          </Button>
          <Button
            variant={activeView === 'pipeline' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveView('pipeline')}
          >
            Sales Pipeline
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => enrichLead.mutate(undefined, {
              onSuccess: () => showToast('Lead enrichment started', 'success'),
              onError: () => showToast('Failed to enrich lead', 'error'),
            })}
            disabled={enrichLead.isPending}
          >
            {enrichLead.isPending ? 'Enriching...' : 'Enrich Leads'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : activeView === 'kanban' ? (
        <KanbanView leads={leads} />
      ) : (
        <PipelineView leads={leads} stats={stats} />
      )}
    </div>
  );
}
