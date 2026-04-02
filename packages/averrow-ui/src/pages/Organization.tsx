import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { MemberInviteSheet } from '@/components/org/MemberInviteSheet';
import { IntegrationCard } from '@/components/org/IntegrationCard';
import type { IntegrationDef } from '@/components/org/IntegrationCard';
import { ConnectIntegrationSheet } from '@/components/org/ConnectIntegrationSheet';
import { ApiKeyCreateSheet } from '@/components/org/ApiKeyCreateSheet';
import { WebhookConfig } from '@/components/org/WebhookConfig';
import { SsoConfig } from '@/components/org/SsoConfig';
import {
  useOrg, useOrgMembers, useOrgBrands, useOrgInvites,
  useOrgApiKeys, useOrgIntegrations,
  useRemoveMember, useUpdateMemberRole, useRevokeInvite,
  useRemoveBrand, useRevokeApiKey, useDeleteIntegration,
  useUpdateOrg,
} from '@/hooks/useOrganization';
import type { Integration } from '@/hooks/useOrganization';

// ─── Integration catalog ────────────────────────────────────

const SIEM_INTEGRATIONS: IntegrationDef[] = [
  { type: 'splunk', category: 'siem', name: 'Splunk', description: 'HTTP Event Collector', logoChar: 'Sp' },
  { type: 'sentinel', category: 'siem', name: 'Microsoft Sentinel', description: 'Log Analytics', logoChar: 'Se' },
  { type: 'elastic', category: 'siem', name: 'Elastic SIEM', description: 'Elasticsearch API', logoChar: 'El' },
  { type: 'qradar', category: 'siem', name: 'IBM QRadar', description: 'CEF/Syslog', logoChar: 'QR' },
];

const TICKETING_INTEGRATIONS: IntegrationDef[] = [
  { type: 'jira', category: 'ticketing', name: 'Jira', description: 'Issue tracking', logoChar: 'Ji' },
  { type: 'servicenow', category: 'ticketing', name: 'ServiceNow', description: 'Incident management', logoChar: 'SN' },
  { type: 'pagerduty', category: 'ticketing', name: 'PagerDuty', description: 'Alerting & on-call', logoChar: 'PD' },
  { type: 'linear', category: 'ticketing', name: 'Linear', description: 'Project tracking', logoChar: 'Li' },
];

const INBOUND_INTEGRATIONS: IntegrationDef[] = [
  { type: 'mimecast', category: 'inbound', name: 'Mimecast', description: 'Email security', logoChar: 'Mc' },
  { type: 'proofpoint', category: 'inbound', name: 'Proofpoint TAP', description: 'Targeted attack protection', logoChar: 'Pp' },
  { type: 'defender', category: 'inbound', name: 'Microsoft Defender', description: 'Endpoint detection', logoChar: 'Df' },
  { type: 'crowdstrike', category: 'inbound', name: 'CrowdStrike', description: 'Threat intelligence', logoChar: 'CS' },
];

// ─── Tab definitions ────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'brands', label: 'Brands' },
  { id: 'members', label: 'Members' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'api-keys', label: 'API Keys' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'sso', label: 'SSO' },
  { id: 'settings', label: 'Settings' },
];

// ─── Main Page ──────────────────────────────────────────────

export function Organization() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showInvite, setShowInvite] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [connectIntegration, setConnectIntegration] = useState<IntegrationDef | null>(null);

  const { data: org, isLoading: orgLoading } = useOrg();
  const { data: members } = useOrgMembers();
  const { data: brands } = useOrgBrands();
  const { data: invites } = useOrgInvites();
  const { data: apiKeys } = useOrgApiKeys();
  const { data: integrations } = useOrgIntegrations();

  if (orgLoading) {
    return <div className="text-sm text-contrail/40 font-mono py-16 text-center">Loading organization...</div>;
  }

  const brandCount = brands?.length ?? 0;
  const memberCount = members?.length ?? 0;
  const maxBrands = org?.max_brands ?? 5;
  const maxMembers = org?.max_members ?? 10;

  const connectedIntegrations = integrations?.filter((i) => i.status === 'connected') ?? [];
  const findIntegration = (type: string): Integration | undefined =>
    integrations?.find((i) => i.type === type);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <OrgHeader
        name="LRX Enterprises"
        slug="lrx-enterprises"
        plan={org?.plan ?? 'enterprise'}
        status={org?.status ?? 'active'}
        brandCount={brandCount}
        memberCount={memberCount}
      />

      {/* Tab Bar */}
      <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          brandCount={brandCount}
          maxBrands={maxBrands}
          memberCount={memberCount}
          maxMembers={maxMembers}
          integrationCount={connectedIntegrations.length}
          plan={org?.plan ?? 'enterprise'}
        />
      )}

      {activeTab === 'brands' && (
        <BrandsTab brands={brands ?? []} maxBrands={maxBrands} />
      )}

      {activeTab === 'members' && (
        <MembersTab
          members={members ?? []}
          invites={invites ?? []}
          onInvite={() => setShowInvite(true)}
        />
      )}

      {activeTab === 'integrations' && (
        <IntegrationsTab
          integrations={integrations ?? []}
          onConnect={setConnectIntegration}
        />
      )}

      {activeTab === 'api-keys' && (
        <ApiKeysTab apiKeys={apiKeys ?? []} onCreate={() => setShowApiKey(true)} />
      )}

      {activeTab === 'webhooks' && <WebhookConfig />}

      {activeTab === 'sso' && <SsoConfig slug={org?.slug ?? 'lrx-enterprises'} />}

      {activeTab === 'settings' && <SettingsTab orgName={org?.name ?? ''} slug={org?.slug ?? ''} />}

      {/* Sheets / Modals */}
      <MemberInviteSheet open={showInvite} onClose={() => setShowInvite(false)} />
      <ApiKeyCreateSheet open={showApiKey} onClose={() => setShowApiKey(false)} />
      <ConnectIntegrationSheet
        open={!!connectIntegration}
        onClose={() => setConnectIntegration(null)}
        integration={connectIntegration}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════

function OrgHeader({ name, slug, plan, status, brandCount, memberCount }: {
  name: string; slug: string; plan: string; status: string; brandCount: number; memberCount: number;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg font-bold text-parchment shrink-0">
        LR
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-parchment font-display">{name}</h1>
          <Badge variant="info">{plan}</Badge>
        </div>
        <p className="text-[11px] text-contrail/50 font-mono mt-0.5">
          {slug}.averrow.com · <span className="capitalize">{status}</span>
        </p>
        <p className="text-[11px] text-contrail/40 font-mono">
          {brandCount} brand{brandCount !== 1 ? 's' : ''} · {memberCount} member{memberCount !== 1 ? 's' : ''} · <span className="capitalize">{plan}</span> plan
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 1 — OVERVIEW
// ═══════════════════════════════════════════════════════════════

function OverviewTab({ brandCount, maxBrands, memberCount, maxMembers, integrationCount, plan }: {
  brandCount: number; maxBrands: number; memberCount: number; maxMembers: number; integrationCount: number; plan: string;
}) {
  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatMiniCard label="Brands Monitored" value={`${brandCount} / ${maxBrands}`} pct={brandCount / maxBrands} />
        <StatMiniCard label="Team Members" value={`${memberCount} / ${maxMembers}`} pct={memberCount / maxMembers} />
        <StatMiniCard label="Threats This Month" value="—" />
        <StatMiniCard label="Active Integrations" value={String(integrationCount)} />
      </div>

      {/* Plan Details */}
      <Card hover={false}>
        <SectionLabel className="mb-3">{plan.toUpperCase()} Plan</SectionLabel>
        <ul className="space-y-1.5 text-[11px] text-parchment/70">
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-positive" /> Unlimited threat monitoring</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-positive" /> Up to {maxBrands} brands, {maxMembers} members</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-positive" /> SIEM integrations</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-positive" /> API access</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-positive" /> Priority support</li>
        </ul>
        <Button variant="ghost" size="sm" className="mt-4 text-contrail/50" disabled>
          Manage Billing
        </Button>
      </Card>
    </div>
  );
}

function StatMiniCard({ label, value, pct }: { label: string; value: string; pct?: number }) {
  return (
    <Card hover={false} className="p-3">
      <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/60 mb-1">{label}</div>
      <div className="text-lg font-bold text-parchment font-display">{value}</div>
      {pct !== undefined && (
        <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-afterburner transition-all"
            style={{ width: `${Math.min(pct * 100, 100)}%` }}
          />
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2 — BRANDS
// ═══════════════════════════════════════════════════════════════

function BrandsTab({ brands, maxBrands }: {
  brands: { brand_id: string; brand_name: string; canonical_domain: string; is_primary: number; threat_count: number }[];
  maxBrands: number;
}) {
  const removeBrand = useRemoveBrand();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-contrail/50 font-mono">{brands.length} / {maxBrands} brands</div>
        <Button variant="secondary" size="sm" disabled={brands.length >= maxBrands}>
          Add Brand
        </Button>
      </div>

      {brands.length === 0 ? (
        <EmptyState message="No brands assigned" description="Add brands to start monitoring threats for your organization." />
      ) : (
        <div className="space-y-3">
          {brands.map((b) => (
            <Card key={b.brand_id} hover={false}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-parchment">{b.brand_name}</span>
                    {b.is_primary === 1 && <Badge variant="info">Primary</Badge>}
                  </div>
                  <div className="text-[11px] text-contrail/50 font-mono mt-0.5">{b.canonical_domain}</div>
                  <div className="text-[10px] text-contrail/40 mt-1">{b.threat_count} threats</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => window.location.href = `/v2/brands/${b.brand_id}`}>
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-accent/60"
                    onClick={() => removeBrand.mutate(b.brand_id)}
                    disabled={removeBrand.isPending}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3 — MEMBERS
// ═══════════════════════════════════════════════════════════════

function MembersTab({ members, invites, onInvite }: {
  members: { user_id: string; user_name: string; email: string; role: string; last_active_at: string | null }[];
  invites: { id: string; email: string; org_role: string; expires_at: string }[];
  onInvite: () => void;
}) {
  const removeMember = useRemoveMember();
  const updateRole = useUpdateMemberRole();
  const revokeInvite = useRevokeInvite();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionLabel>Team Members</SectionLabel>
        <Button size="sm" onClick={onInvite}>Invite Member</Button>
      </div>

      {members.length === 0 ? (
        <EmptyState message="No members yet" action={{ label: 'Invite Member', onClick: onInvite }} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-contrail/40 font-mono uppercase tracking-wider border-b border-white/5">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2 pr-4 hidden sm:table-cell">Last Active</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} className="border-b border-white/[0.03]">
                  <td className="py-3 pr-4 text-parchment font-medium">{m.user_name}</td>
                  <td className="py-3 pr-4 text-contrail/60 font-mono">{m.email}</td>
                  <td className="py-3 pr-4">
                    <select
                      value={m.role}
                      onChange={(e) => updateRole.mutate({ userId: m.user_id, role: e.target.value })}
                      className="bg-transparent border border-white/10 rounded px-1.5 py-0.5 text-[10px] font-mono text-parchment/70"
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="analyst">Analyst</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td className="py-3 pr-4 text-contrail/40 hidden sm:table-cell">
                    {m.last_active_at ? new Date(m.last_active_at).toLocaleDateString() : 'never'}
                  </td>
                  <td className="py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-accent/60"
                      onClick={() => removeMember.mutate(m.user_id)}
                      disabled={removeMember.isPending}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pending Invitations */}
      <div>
        <SectionLabel className="mb-2">Pending Invitations</SectionLabel>
        {invites.length === 0 ? (
          <p className="text-[11px] text-contrail/40">No pending invitations</p>
        ) : (
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                <div>
                  <span className="text-[11px] text-parchment/80 font-mono">{inv.email}</span>
                  <span className="text-[10px] text-contrail/40 ml-2 capitalize">{inv.org_role}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-accent/60"
                  onClick={() => revokeInvite.mutate(inv.id)}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 4 — INTEGRATIONS
// ═══════════════════════════════════════════════════════════════

function IntegrationsTab({ integrations, onConnect }: {
  integrations: Integration[];
  onConnect: (def: IntegrationDef) => void;
}) {
  const deleteIntegration = useDeleteIntegration();

  const findConnected = (type: string) => integrations.find((i) => i.type === type);

  const renderSection = (label: string, defs: IntegrationDef[]) => (
    <div>
      <SectionLabel className="mb-3">{label}</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {defs.map((def) => {
          const connected = findConnected(def.type);
          return (
            <IntegrationCard
              key={def.type}
              def={def}
              connected={!!connected}
              status={connected?.status}
              lastSync={connected?.last_sync_at}
              eventsSent={connected?.events_sent}
              lastError={connected?.last_error}
              onConnect={() => onConnect(def)}
              onConfigure={() => onConnect(def)}
              onDisconnect={() => connected && deleteIntegration.mutate(connected.id)}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {renderSection('SIEM & Logging', SIEM_INTEGRATIONS)}
      {renderSection('Ticketing & Incident Management', TICKETING_INTEGRATIONS)}
      {renderSection('Inbound Feeds', INBOUND_INTEGRATIONS)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 5 — API KEYS
// ═══════════════════════════════════════════════════════════════

function ApiKeysTab({ apiKeys, onCreate }: {
  apiKeys: { id: string; name: string; key_prefix: string; scopes: string; last_used_at: string | null; created_at: string }[];
  onCreate: () => void;
}) {
  const revokeKey = useRevokeApiKey();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <SectionLabel>API Keys</SectionLabel>
          <p className="text-[11px] text-contrail/40 mt-1">
            API keys allow programmatic access to your org's threat data.
          </p>
        </div>
        <Button size="sm" onClick={onCreate}>Create API Key</Button>
      </div>

      {apiKeys.length === 0 ? (
        <EmptyState
          message="No API keys"
          description="Create an API key to integrate with your systems."
          action={{ label: 'Create API Key', onClick: onCreate }}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-contrail/40 font-mono uppercase tracking-wider border-b border-white/5">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Prefix</th>
                <th className="pb-2 pr-4">Scopes</th>
                <th className="pb-2 pr-4">Last Used</th>
                <th className="pb-2 pr-4 hidden sm:table-cell">Created</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((k) => {
                let scopes: string[] = [];
                try { scopes = JSON.parse(k.scopes); } catch { /* empty */ }
                return (
                  <tr key={k.id} className="border-b border-white/[0.03]">
                    <td className="py-3 pr-4 text-parchment font-medium">{k.name}</td>
                    <td className="py-3 pr-4 font-mono text-contrail/60">{k.key_prefix}...</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {scopes.map((s) => (
                          <span key={s} className="text-[9px] font-mono bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-contrail/50">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-contrail/40">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'never'}
                    </td>
                    <td className="py-3 pr-4 text-contrail/40 hidden sm:table-cell">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-accent/60"
                        onClick={() => revokeKey.mutate(k.id)}
                        disabled={revokeKey.isPending}
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 7 — SETTINGS
// ═══════════════════════════════════════════════════════════════

function SettingsTab({ orgName, slug }: { orgName: string; slug: string }) {
  const [name, setName] = useState(orgName || 'LRX Enterprises');
  const [email, setEmail] = useState('cleerox@gmail.com');
  const updateOrg = useUpdateOrg();

  return (
    <div className="space-y-6">
      {/* Organization Details */}
      <Card hover={false}>
        <SectionLabel className="mb-4">Organization Details</SectionLabel>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] text-contrail/60 font-mono uppercase tracking-wide mb-1">
              Organization Name
            </label>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="glass-input rounded-md px-3 py-2 text-sm flex-1"
              />
              <Button
                variant="secondary"
                size="md"
                onClick={() => updateOrg.mutate({ name })}
                disabled={updateOrg.isPending}
              >
                Save
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-contrail/60 font-mono uppercase tracking-wide mb-1">
              Billing Email
            </label>
            <div className="flex gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input rounded-md px-3 py-2 text-sm flex-1"
              />
              <Button variant="secondary" size="md" disabled>Save</Button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-contrail/60 font-mono uppercase tracking-wide mb-1">
              Slug
            </label>
            <div className="text-sm text-contrail/50 font-mono">{slug || 'lrx-enterprises'} (read-only)</div>
          </div>
        </div>
      </Card>

      {/* SSO Configuration — now has its own tab */}
      <Card hover={false}>
        <SectionLabel className="mb-3">SSO Configuration</SectionLabel>
        <p className="text-[11px] text-contrail/50 mb-3">
          Configure Single Sign-On for your organization in the dedicated SSO tab.
        </p>
      </Card>

      {/* SCIM Provisioning */}
      <Card hover={false}>
        <SectionLabel className="mb-3">SCIM Provisioning</SectionLabel>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-contrail/60 font-mono">Status</span>
            <span className="text-contrail/40">Not configured</span>
          </div>
          <Button variant="secondary" size="sm" className="mt-2" disabled>
            Enable SCIM — Coming Soon
          </Button>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card hover={false} className="border-accent/20">
        <SectionLabel className="mb-3 text-accent">Danger Zone</SectionLabel>
        <Button variant="danger" size="sm" disabled title="Contact support to delete your organization">
          Delete Organization
        </Button>
        <p className="text-[10px] text-contrail/30 mt-2">Contact support to delete your organization.</p>
      </Card>
    </div>
  );
}
