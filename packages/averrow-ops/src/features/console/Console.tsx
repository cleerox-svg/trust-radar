// SOC Console — the v4 analyst daily-driver workspace (W1).
//
// A cinematic header (KPI hero + deep-linkable tab bar) over the EXISTING
// queue pages mounted as tab bodies — no page-logic rewrites. Reuses the
// ?tab= URL pattern from features/leads/Leads.tsx so reload + share-links
// land on the right tab. Built on @averrow/shared/ui (the v4 design system).
//
// Reachable at /console from the v4 sidebar; standalone routes (/alerts,
// /threats, /admin/incidents, /admin/takedowns) stay intact for deep links
// and detail navigation.

import { Suspense, lazy, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Radar, Crosshair, Siren, Gavel } from 'lucide-react';
import { Button, Card } from '@averrow/shared/ui';
import { api } from '@/lib/api';

type ConsoleTab = 'signals' | 'threats' | 'incidents' | 'takedowns';

const TABS: { id: ConsoleTab; label: string; icon: typeof Radar }[] = [
  { id: 'signals',   label: 'Signals',   icon: Radar },
  { id: 'threats',   label: 'Threats',   icon: Crosshair },
  { id: 'incidents', label: 'Incidents', icon: Siren },
  { id: 'takedowns', label: 'Takedowns', icon: Gavel },
];
const TAB_VALUES: readonly string[] = TABS.map(t => t.id);
function isTab(v: string | null): v is ConsoleTab {
  return v != null && TAB_VALUES.includes(v);
}

// Existing queue pages, mounted as tab bodies (no rewrites).
const Alerts = lazy(() => import('@/features/alerts/Alerts').then(m => ({ default: m.Alerts })));
const Threats = lazy(() => import('@/features/threats/Threats').then(m => ({ default: m.Threats })));
const AdminIncidents = lazy(() => import('@/features/admin-incidents/Incidents').then(m => ({ default: m.AdminIncidents })));
const Takedowns = lazy(() => import('@/features/takedowns/Takedowns').then(m => ({ default: m.Takedowns })));

export function Console() {
  const [params, setParams] = useSearchParams();
  const initial: ConsoleTab = isTab(params.get('tab')) ? (params.get('tab') as ConsoleTab) : 'signals';
  const [tab, setTab] = useState<ConsoleTab>(initial);
  const [openSignals, setOpenSignals] = useState<number | null>(null);

  useEffect(() => {
    // Same lightweight count the sidebar uses — real metric, no new endpoint.
    api.get<unknown>('/api/alerts?status=open&limit=1')
      .then(d => setOpenSignals(d.total ?? 0))
      .catch(() => {});
  }, []);

  function selectTab(next: ConsoleTab) {
    setTab(next);
    const p = new URLSearchParams(params);
    if (next === 'signals') p.delete('tab'); // default — keep URLs clean
    else p.set('tab', next);
    setParams(p, { replace: true });
  }

  const activeLabel = TABS.find(t => t.id === tab)?.label ?? '';

  return (
    <div style={{ padding: '20px 22px 40px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.18em', color: 'var(--text-muted)', marginBottom: 6 }}>
        SOC CONSOLE
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.3px', margin: 0 }}>Console</h1>

      {/* KPI hero */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14, margin: '18px 0' }}>
        <GlowStat label="Open signals" value={openSignals} accent="var(--amber)" />
        <GlowStat label="Now viewing" valueText={activeLabel} sub="active queue" accent="var(--blue)" />
      </div>

      {/* deep-linkable tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <Button
              key={t.id}
              variant={tab === t.id ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => selectTab(t.id)}
            >
              <Icon size={14} strokeWidth={2} /> {t.label}
            </Button>
          );
        })}
      </div>

      {/* active surface — existing page rendered as-is */}
      <Suspense fallback={<TabLoading />}>
        {tab === 'signals'   && <Alerts />}
        {tab === 'threats'   && <Threats />}
        {tab === 'incidents' && <AdminIncidents />}
        {tab === 'takedowns' && <Takedowns />}
      </Suspense>
    </div>
  );
}

function TabLoading() {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      Loading…
    </div>
  );
}

function GlowStat({
  label, value, valueText, sub, accent,
}: { label: string; value?: number | null; valueText?: string; sub?: string; accent: string }) {
  const display = valueText ?? (value == null ? '—' : value.toLocaleString());
  return (
    <Card variant="glow" style={{ padding: '16px 18px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', marginTop: 8, textShadow: `0 0 24px ${accent}66` }}>
        {display}
      </div>
      {sub && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 6 }}>{sub}</div>
      )}
    </Card>
  );
}
