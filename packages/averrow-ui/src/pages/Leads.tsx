import { useState, useMemo } from 'react';
import { useLeads, useLeadStats, useEnrichLead, useUpdateLead } from '@/hooks/useLeads';
import type { SalesLead, LeadStats } from '@/hooks/useLeads';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Table, Th, Td } from '@/components/ui/Table';
import { TableLoader } from '@/components/ui/PageLoader';
import { DrillHeader } from '@/components/mobile/DrillHeader';
import { useToast } from '@/components/ui/Toast';
import { relativeTime } from '@/lib/time';
import { Target } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { BIMIGradeBadge } from '@/components/ui/BIMIGradeBadge';

const PIPELINE_STATUSES = ['new', 'researched', 'drafted', 'approved', 'sent', 'responded', 'meeting', 'converted'] as const;

function columnLabel(s: string) {
  return s.replace(/_/g, ' ').toUpperCase();
}

function gradeVariant(grade: string | null): 'critical' | 'high' | 'medium' | 'low' | 'success' {
  if (!grade) return 'low';
  const g = grade.toUpperCase();
  if (g === 'F') return 'critical';
  if (g === 'D' || g === 'D+' || g === 'D-') return 'high';
  if (g === 'C' || g === 'C+' || g === 'C-') return 'medium';
  if (g === 'B' || g === 'B+' || g === 'B-') return 'low';
  return 'success'; // A, A+
}

function parseOutreach(raw: string | null): { subject: string; body: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { subject?: string; body?: string };
    if (parsed.subject && parsed.body) return { subject: parsed.subject, body: parsed.body };
  } catch {
    // Not JSON — treat as plain text
    return { subject: '', body: raw };
  }
  return null;
}

// ─── Kanban View ────────────────────────────────────────────────

function KanbanCard({ lead, onClick }: { lead: SalesLead; onClick: () => void }) {
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={e => e.key === 'Enter' && onClick()} className="cursor-pointer">
    <Card className="space-y-2">
      <div className="font-display font-semibold text-sm text-parchment truncate">
        {lead.company_name ?? 'Unnamed Lead'}
      </div>
      <div className="font-mono text-[11px] text-white/55 truncate">{lead.company_domain ?? '—'}</div>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-afterburner/10 border border-afterburner/20 font-display text-lg font-bold text-afterburner">
          {lead.prospect_score}
        </span>
        {lead.pitch_angle && (
          <Badge variant="info" className="text-[8px] truncate max-w-[140px]">
            {lead.pitch_angle.replace(/_/g, ' ')}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 text-[10px] font-mono text-contrail/60">
        {lead.email_security_grade && (
          <BIMIGradeBadge grade={lead.email_security_grade} size="sm" showLabel tooltip />
        )}
        {lead.threat_count_30d != null && (
          <span className="text-white/55">{lead.email_security_grade ? '· ' : ''}{lead.threat_count_30d} threats/30d</span>
        )}
      </div>
      {lead.ai_enriched === 1 && (
        <div className="flex items-center gap-1 text-[10px] font-mono text-positive/70">
          <span>✓</span> AI Enriched
        </div>
      )}
    </Card>
    </div>
  );
}

function KanbanView({ leads, onSelect }: { leads: SalesLead[]; onSelect: (lead: SalesLead) => void }) {
  const grouped = PIPELINE_STATUSES.reduce<Record<string, SalesLead[]>>((acc, col) => {
    acc[col] = leads.filter(l => l.status === col);
    return acc;
  }, {} as Record<string, SalesLead[]>);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
      {PIPELINE_STATUSES.map(col => (
        <div key={col} className="min-w-[260px] max-w-[300px] flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <SectionLabel>{columnLabel(col)}</SectionLabel>
            <Badge variant="info">{grouped[col]?.length ?? 0}</Badge>
          </div>
          <div className="space-y-3">
            {(grouped[col] || []).map(lead => (
              <KanbanCard key={lead.id} lead={lead} onClick={() => onSelect(lead)} />
            ))}
            {(grouped[col] || []).length === 0 && (
              <EmptyState
                icon={<Target />}
                title="No leads"
                subtitle={col === 'new'
                  ? 'Run Pathfinder to discover brands that need Averrow'
                  : `No leads in ${columnLabel(col).toLowerCase()} stage`}
                variant="scanning"
                compact
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Pipeline Table View ────────────────────────────────────────

function getPipelineCount(stats: LeadStats['pipeline'], status: string): number {
  const map: Record<string, keyof LeadStats['pipeline']> = {
    new: 'new_count',
    researched: 'researched_count',
    drafted: 'drafted_count',
    approved: 'approved_count',
    sent: 'sent_count',
    responded: 'responded_count',
    meeting: 'meeting_count',
    converted: 'converted_count',
  };
  const key = map[status];
  return key ? (stats[key] as number) ?? 0 : 0;
}

function PipelineView({ leads, stats, onSelect }: { leads: SalesLead[]; stats: LeadStats | null; onSelect: (lead: SalesLead) => void }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [pitchFilter, setPitchFilter] = useState('');
  const [search, setSearch] = useState('');

  const filtered = leads.filter(l => {
    if (statusFilter && l.status !== statusFilter) return false;
    if (pitchFilter && l.pitch_angle !== pitchFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        l.company_name?.toLowerCase().includes(q) ||
        l.company_domain?.toLowerCase().includes(q)
      );
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
                <div className="font-display text-lg font-bold text-parchment">{getPipelineCount(stats.pipeline, s)}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-contrail/50">{s}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-contrail/50">Response Rate</span>
                <span className="font-mono text-xs text-parchment">{(stats.response_rate ?? 0).toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded overflow-hidden">
                <div className="h-full bg-positive rounded" style={{ width: `${stats.response_rate ?? 0}%` }} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-contrail/50">Conversion Rate</span>
                <span className="font-mono text-xs text-parchment">{(stats.conversion_rate ?? 0).toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded overflow-hidden">
                <div className="h-full bg-accent rounded" style={{ width: `${stats.conversion_rate ?? 0}%` }} />
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
            ...pitchAngles.map(p => ({ value: p, label: p.replace(/_/g, ' ') })),
          ]}
        />
        <Input
          placeholder="Search company or domain..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-56"
        />
      </div>

      <div className="overflow-x-auto">
        <Card hover={false} className="p-0 overflow-hidden">
          <Table>
            <thead>
              <tr>
                <Th>Company</Th>
                <Th>Domain</Th>
                <Th>Score</Th>
                <Th>Grade</Th>
                <Th>Threats</Th>
                <Th>Pitch Angle</Th>
                <Th>Status</Th>
                <Th>Enriched</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => (
                <tr
                  key={lead.id}
                  className="data-row"
                  onClick={() => onSelect(lead)}
                >
                  <Td>
                    <span className="font-display font-semibold text-sm text-parchment">
                      {lead.company_name ?? 'Unnamed'}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-contrail/60">
                      {lead.company_domain ?? '—'}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-sm font-bold text-afterburner">
                      {lead.prospect_score}
                    </span>
                  </Td>
                  <Td>
                    {lead.email_security_grade ? (
                      <Badge variant={gradeVariant(lead.email_security_grade)}>
                        {lead.email_security_grade}
                      </Badge>
                    ) : '—'}
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-contrail/60">
                      {lead.threat_count_30d ?? '—'}
                    </span>
                  </Td>
                  <Td>
                    {lead.pitch_angle ? (
                      <Badge variant="info" className="text-[8px]">
                        {lead.pitch_angle.replace(/_/g, ' ')}
                      </Badge>
                    ) : '—'}
                  </Td>
                  <Td><Badge variant="default">{columnLabel(lead.status)}</Badge></Td>
                  <Td>
                    {lead.ai_enriched === 1 ? (
                      <span className="text-positive font-mono text-xs">✓</span>
                    ) : (
                      <span className="text-white/40 font-mono text-xs">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {filtered.length === 0 && (
            <p className="text-sm text-white/40 text-center py-8">No leads match the current filters.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Lead Detail View ───────────────────────────────────────────

function LeadDetail({ lead, onBack }: { lead: SalesLead; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'variant1' | 'variant2'>('variant1');
  const updateLead = useUpdateLead();
  const { showToast } = useToast();

  const outreach1 = parseOutreach(lead.outreach_variant_1);
  const outreach2 = parseOutreach(lead.outreach_variant_2);

  function handleStatusChange(newStatus: string) {
    updateLead.mutate({ id: lead.id, status: newStatus }, {
      onSuccess: () => showToast(`Lead moved to ${newStatus}`, 'success'),
      onError: () => showToast('Failed to update status', 'error'),
    });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(
      () => showToast('Copied to clipboard', 'success'),
      () => showToast('Failed to copy', 'error'),
    );
  }

  return (
    <div className="animate-fade-in">
      <DrillHeader
        title={lead.company_name ?? 'Lead Detail'}
        badge={lead.email_security_grade ? `Grade ${lead.email_security_grade}` : undefined}
        onBack={onBack}
      />

      <div className="pt-14 space-y-6">
        {/* Subtitle */}
        <div className="flex flex-wrap items-center gap-2 text-contrail/60 font-mono text-xs">
          {lead.company_domain && <span>{lead.company_domain}</span>}
          {lead.company_domain && <span>·</span>}
          <span>Score: <span className="text-afterburner font-bold">{lead.prospect_score}</span></span>
          {lead.email_security_grade && (
            <>
              <span>·</span>
              <span>Grade: </span>
              <Badge variant={gradeVariant(lead.email_security_grade)} className="text-[8px] py-0 px-1.5">
                {lead.email_security_grade}
              </Badge>
            </>
          )}
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Prospect Score" value={lead.prospect_score} accentColor="#E5A832" />
          <StatCard
            label="Email Grade"
            value={lead.email_security_grade ?? '—'}
            accentColor={lead.email_security_grade === 'F' ? '#C83C3C' : lead.email_security_grade === 'C' ? '#FB923C' : '#0A8AB5'}
          />
          <StatCard label="Threats / 30d" value={lead.threat_count_30d ?? 0} accentColor="#C83C3C" />
          <StatCard label="Status" value={columnLabel(lead.status)} />
        </div>

        {/* AI Findings */}
        <Card hover={false}>
          <SectionLabel className="mb-3">AI Findings</SectionLabel>
          {lead.findings_summary ? (
            <p className="text-sm text-parchment/80 leading-relaxed whitespace-pre-line">
              {lead.findings_summary}
            </p>
          ) : (
            <p className="text-sm text-white/40 italic">No AI findings yet. Enrich this lead to generate analysis.</p>
          )}
        </Card>

        {/* Outreach Emails */}
        {lead.ai_enriched === 1 && (outreach1 || outreach2) && (
          <Card hover={false}>
            <SectionLabel className="mb-3">Outreach Emails</SectionLabel>
            <div className="flex gap-2 mb-4">
              {outreach1 && (
                <Button
                  variant={activeTab === 'variant1' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setActiveTab('variant1')}
                >
                  Variant 1
                </Button>
              )}
              {outreach2 && (
                <Button
                  variant={activeTab === 'variant2' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setActiveTab('variant2')}
                >
                  Variant 2
                </Button>
              )}
            </div>
            {activeTab === 'variant1' && outreach1 && (
              <div className="space-y-3">
                {outreach1.subject && (
                  <div>
                    <span className="font-mono text-[10px] text-white/55 uppercase">Subject</span>
                    <p className="text-sm text-parchment font-semibold mt-1">{outreach1.subject}</p>
                  </div>
                )}
                <div>
                  <span className="font-mono text-[10px] text-white/55 uppercase">Body</span>
                  <p className="text-sm text-parchment/70 mt-1 whitespace-pre-line leading-relaxed">{outreach1.body}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(`Subject: ${outreach1.subject}\n\n${outreach1.body}`)}
                >
                  Copy
                </Button>
              </div>
            )}
            {activeTab === 'variant2' && outreach2 && (
              <div className="space-y-3">
                {outreach2.subject && (
                  <div>
                    <span className="font-mono text-[10px] text-white/55 uppercase">Subject</span>
                    <p className="text-sm text-parchment font-semibold mt-1">{outreach2.subject}</p>
                  </div>
                )}
                <div>
                  <span className="font-mono text-[10px] text-white/55 uppercase">Body</span>
                  <p className="text-sm text-parchment/70 mt-1 whitespace-pre-line leading-relaxed">{outreach2.body}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(`Subject: ${outreach2.subject}\n\n${outreach2.body}`)}
                >
                  Copy
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Contact Info */}
        <Card hover={false}>
          <SectionLabel className="mb-3">Contact</SectionLabel>
          {lead.target_name ? (
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-contrail/50 font-mono text-[10px] uppercase w-16">Name</span>
                <span className="text-parchment">{lead.target_name}</span>
              </div>
              {lead.target_title && (
                <div className="flex gap-2">
                  <span className="text-contrail/50 font-mono text-[10px] uppercase w-16">Title</span>
                  <span className="text-parchment/70">{lead.target_title}</span>
                </div>
              )}
              {lead.target_email && (
                <div className="flex gap-2">
                  <span className="text-contrail/50 font-mono text-[10px] uppercase w-16">Email</span>
                  <span className="text-parchment/70 font-mono text-xs">{lead.target_email}</span>
                </div>
              )}
              {lead.target_linkedin && (
                <div className="flex gap-2">
                  <span className="text-contrail/50 font-mono text-[10px] uppercase w-16">LinkedIn</span>
                  <span className="text-parchment/70 font-mono text-xs">{lead.target_linkedin}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-white/40 italic">Not yet researched</p>
          )}
        </Card>

        {/* Actions */}
        <Card hover={false}>
          <SectionLabel className="mb-3">Actions</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {lead.status === 'new' && (
              <Button variant="secondary" size="sm" onClick={() => handleStatusChange('researched')} disabled={updateLead.isPending}>
                Mark as Researched
              </Button>
            )}
            {lead.status === 'researched' && (
              <Button variant="secondary" size="sm" onClick={() => handleStatusChange('drafted')} disabled={updateLead.isPending}>
                Draft Outreach
              </Button>
            )}
            {lead.status === 'drafted' && (
              <Button variant="primary" size="sm" onClick={() => handleStatusChange('approved')} disabled={updateLead.isPending}>
                Approve
              </Button>
            )}
            {lead.status === 'approved' && (
              <Button variant="primary" size="sm" onClick={() => handleStatusChange('sent')} disabled={updateLead.isPending}>
                Mark as Sent
              </Button>
            )}
            {lead.status === 'sent' && (
              <Button variant="secondary" size="sm" onClick={() => handleStatusChange('responded')} disabled={updateLead.isPending}>
                Mark Responded
              </Button>
            )}
            {lead.status === 'responded' && (
              <Button variant="secondary" size="sm" onClick={() => handleStatusChange('meeting')} disabled={updateLead.isPending}>
                Book Meeting
              </Button>
            )}
            {lead.status === 'meeting' && (
              <Button variant="primary" size="sm" onClick={() => handleStatusChange('converted')} disabled={updateLead.isPending}>
                Convert
              </Button>
            )}
          </div>
          <div className="mt-2 font-mono text-[10px] text-white/50">
            Created {relativeTime(lead.created_at)} · Updated {relativeTime(lead.updated_at)}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Enrich Leads Tab ───────────────────────────────────────────

function EnrichView({ leads }: { leads: SalesLead[] }) {
  const enrichLead = useEnrichLead();
  const { showToast } = useToast();

  const unenriched = leads.filter(l => l.ai_enriched !== 1);
  const enriched = leads.filter(l => l.ai_enriched === 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Total Leads" value={leads.length} />
        <StatCard label="AI Enriched" value={enriched.length} accentColor="#4ade80" />
        <StatCard label="Awaiting Enrichment" value={unenriched.length} accentColor="#E5A832" />
      </div>

      {unenriched.length > 0 && (
        <Card hover={false}>
          <div className="flex items-center justify-between mb-4">
            <SectionLabel>Un-enriched Leads</SectionLabel>
            <Button
              variant="primary"
              size="sm"
              onClick={() => enrichLead.mutate(undefined, {
                onSuccess: () => showToast('Lead enrichment triggered', 'success'),
                onError: () => showToast('Failed to trigger enrichment', 'error'),
              })}
              disabled={enrichLead.isPending}
            >
              {enrichLead.isPending ? 'Enriching...' : 'Enrich Next Lead'}
            </Button>
          </div>
          <div className="space-y-2">
            {unenriched.map(lead => (
              <div key={lead.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-cockpit border border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <span className="font-display font-semibold text-sm text-parchment">
                    {lead.company_name ?? 'Unnamed'}
                  </span>
                  <span className="font-mono text-[11px] text-white/55">
                    {lead.company_domain ?? ''}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-afterburner">{lead.prospect_score}</span>
                  {lead.email_security_grade && (
                    <Badge variant={gradeVariant(lead.email_security_grade)} className="text-[8px] py-0 px-1.5">
                      {lead.email_security_grade}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {unenriched.length === 0 && (
        <Card hover={false}>
          <p className="text-sm text-positive/70 text-center py-6 font-mono">
            All leads have been AI enriched.
          </p>
        </Card>
      )}
    </div>
  );
}

// ─── Main Leads Page ────────────────────────────────────────────

export function Leads() {
  const [activeView, setActiveView] = useState<'kanban' | 'pipeline' | 'enrich'>('kanban');
  const [selectedLead, setSelectedLead] = useState<SalesLead | null>(null);
  const { data: leadsRes, isLoading } = useLeads();
  const { data: stats } = useLeadStats();

  const leads = useMemo(() => leadsRes?.data || [], [leadsRes]);

  if (isLoading) return <TableLoader rows={8} />;

  // Detail view
  if (selectedLead) {
    // Find fresh version of lead from data (in case it was updated)
    const freshLead = leads.find(l => l.id === selectedLead.id) ?? selectedLead;
    return <LeadDetail lead={freshLead} onBack={() => setSelectedLead(null)} />;
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-parchment">Lead Management</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeView === 'kanban' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveView('kanban')}
          >
            Kanban
          </Button>
          <Button
            variant={activeView === 'pipeline' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveView('pipeline')}
          >
            Sales Pipeline
          </Button>
          <Button
            variant={activeView === 'enrich' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveView('enrich')}
          >
            Enrich Leads
          </Button>
        </div>
      </div>

      {activeView === 'kanban' && (
        <KanbanView leads={leads} onSelect={setSelectedLead} />
      )}
      {activeView === 'pipeline' && (
        <PipelineView leads={leads} stats={stats ?? null} onSelect={setSelectedLead} />
      )}
      {activeView === 'enrich' && (
        <EnrichView leads={leads} />
      )}
    </div>
  );
}
