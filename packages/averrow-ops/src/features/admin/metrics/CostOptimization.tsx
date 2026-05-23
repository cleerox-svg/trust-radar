// Cost Optimization tab — measurement view for the AI cost-reduction
// plan tracked in /root/.claude/plans/can-you-review-the-purring-pearl.md.
//
// Sibling of AiSpend. Where AiSpend answers "what does the platform
// cost?", this view answers "are the cost-reduction levers working?".
//
// Three blocks:
//
//   1. Focus-agent cards (cartographer / analyst / sentinel) — each
//      shows cost, calls, cost-per-call, and the out:in token ratio
//      for a selected window. The out:in ratio is the key indicator
//      for Lever #1 (output-schema tightening) — it drops as verbose
//      JSON is trimmed.
//
//   2. Cartographer 30-day daily chart — paints cost + calls + out:in
//      ratio as lines so operators can see exactly which day a lever
//      landed (e.g. cost-per-call drops 50% the day Lever #6 ships).
//
//   3. Lever roster — static list mirroring the plan file. Each card
//      shows status (planned / in_progress / deployed), estimated
//      annual savings, and the indicator metric to watch.

import { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import { Card } from '@/design-system/components';
import { Badge } from '@/components/ui/Badge';
import { useAiCostOptimization } from '@/hooks/useMetrics';
import type {
  AiCostOptPayload, AiCostOptAgentMetrics, AiCostOptLever,
} from '@/hooks/useMetrics';
import { AgentIcon } from '@/components/brand/AgentIcon';
import { AGENT_METADATA, type AgentId } from '@/lib/agent-metadata';

type Window = '24h' | '7d' | '30d';
const WINDOWS: Window[] = ['24h', '7d', '30d'];

export function CostOptimization() {
  const { data, isLoading, isError } = useAiCostOptimization();
  const [windowSel, setWindowSel] = useState<Window>('24h');

  if (isError) {
    return (
      <Card className="p-4">
        <p className="font-mono text-[10px]" style={{ color: 'var(--sev-critical)' }}>
          Failed to load cost-optimization metrics. Try again in a moment.
        </p>
      </Card>
    );
  }
  if (isLoading || !data) {
    return (
      <Card className="p-4">
        <p className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
          Loading cost-optimization metrics…
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Intro />
      <Header windowSel={windowSel} onWindowChange={setWindowSel} />
      <FocusAgents data={data} window={windowSel} />
      <CartographerTrend data={data} />
      <LeverRoster levers={data.levers} />
    </div>
  );
}

function Intro() {
  return (
    <Card variant="elevated" className="p-4">
      <div
        className="font-mono text-[10px] tracking-[0.20em] uppercase font-bold mb-2"
        style={{ color: 'var(--amber)' }}
      >
        What this is
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Tracks the AI cost-reduction plan. The three focus agents
        (cartographer, analyst, sentinel) account for ~97% of platform
        AI spend. Watch the <strong>output:input ratio</strong> drop as
        Lever&nbsp;#1 (output-schema tightening) lands, the <strong>call
        count</strong> drop as Lever&nbsp;#1b/#2/#3 (batching + skip
        filters) lands, and <strong>cost-per-call</strong> drop ~50% if
        Lever&nbsp;#6 (Message Batches API) is wired up for cartographer.
      </p>
    </Card>
  );
}

function Header({ windowSel, onWindowChange }: { windowSel: Window; onWindowChange: (w: Window) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span
        className="font-mono text-[10px] tracking-[0.20em] uppercase font-bold"
        style={{ color: 'var(--text-primary)' }}
      >
        Window
      </span>
      <div
        role="radiogroup"
        aria-label="Cost optimization window"
        className="inline-flex rounded-md overflow-hidden"
        style={{
          border:     '1px solid var(--border-base)',
          background: 'var(--bg-input)',
        }}
      >
        {WINDOWS.map((w) => {
          const active = w === windowSel;
          return (
            <button
              key={w}
              role="radio"
              aria-checked={active}
              onClick={() => onWindowChange(w)}
              className="px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors"
              style={{
                background: active ? 'var(--amber)' : 'transparent',
                color:      active ? '#0A0F1C' : 'var(--text-secondary)',
                fontWeight: active ? 600 : 500,
              }}
            >
              {w}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Focus agent cards ──────────────────────────────────────────
function FocusAgents({ data, window }: { data: AiCostOptPayload; window: Window }) {
  const w = data.windows[window];
  return (
    <div className="space-y-3">
      <SectionHeader title={`Focus agents · ${window}`} count={data.focus_agents.length} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {data.focus_agents.map((agentId) => (
          <FocusAgentCard
            key={agentId}
            agentId={agentId}
            metrics={w[agentId] ?? { calls: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 }}
          />
        ))}
      </div>
    </div>
  );
}

function FocusAgentCard({ agentId, metrics }: { agentId: string; metrics: AiCostOptAgentMetrics }) {
  const meta = AGENT_METADATA[agentId as AgentId];
  const costPerCall = metrics.calls > 0 ? metrics.cost_usd / metrics.calls : 0;
  // Output is 5x input on Haiku — out:in ratio near 1.0 means output
  // tokens dominate cost. Lever #1 aims to push this below 0.5.
  const outInRatio = metrics.input_tokens > 0
    ? metrics.output_tokens / metrics.input_tokens
    : 0;
  const ratioTier = outInRatio >= 0.9 ? 'critical'
                  : outInRatio >= 0.5 ? 'high'
                  : 'green';
  const ratioColor = ratioTier === 'critical' ? 'var(--sev-critical)'
                   : ratioTier === 'high'     ? 'var(--sev-high)'
                   : 'var(--green)';
  const tint = meta?.color ?? 'var(--blue)';

  return (
    <Card variant="elevated" className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: tint }} className="flex-shrink-0">
          <AgentIcon agent={agentId} size={20} />
        </span>
        <span
          className="font-mono text-[12px] font-bold uppercase tracking-wide truncate flex-1"
          style={{ color: 'var(--text-primary)' }}
        >
          {meta?.displayName ?? agentId}
        </span>
        {ratioTier === 'critical' && <Badge severity="critical">Out-heavy</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Stat label="Cost"      value={`$${metrics.cost_usd.toFixed(4)}`} />
        <Stat label="Calls"     value={metrics.calls.toLocaleString()} />
        <Stat label="Cost/call" value={`$${costPerCall.toFixed(5)}`} />
        <Stat
          label="Out:in ratio"
          value={outInRatio.toFixed(2)}
          valueColor={ratioColor}
        />
      </div>

      <div
        className="rounded overflow-hidden"
        style={{ height: 3, background: 'var(--border-base)' }}
        title={`Output / input token ratio (lever #1 target: <0.5)`}
      >
        <div
          style={{
            height:     '100%',
            width:      `${Math.min(100, outInRatio * 100)}%`,
            background: ratioColor,
          }}
        />
      </div>
      <div className="flex justify-between font-mono text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>
        <span>OUT:IN RATIO</span>
        <span>TARGET &lt; 0.50</span>
      </div>
    </Card>
  );
}

// ─── Cartographer 30d trend ──────────────────────────────────────
function CartographerTrend({ data }: { data: AiCostOptPayload }) {
  const chartData = data.cartographer_daily_30d.map((d) => ({
    day:        d.day.slice(5),
    cost:       Number(d.cost_usd.toFixed(4)),
    calls:      d.calls,
    out_in:     d.input_tokens > 0 ? Number((d.output_tokens / d.input_tokens).toFixed(2)) : 0,
    cost_per_call: d.calls > 0 ? Number((d.cost_usd / d.calls).toFixed(5)) : 0,
  }));

  if (chartData.length === 0) {
    return (
      <Card variant="elevated" className="p-4">
        <SectionHeader title="Cartographer · 30d trend" />
        <p className="font-mono text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
          No cartographer spend recorded in the last 30 days.
        </p>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="p-4">
      <SectionHeader title="Cartographer · 30d trend" />
      <div
        className="font-mono text-[9px] mt-1 mb-3"
        style={{ color: 'var(--text-muted)' }}
      >
        Watch <strong>out:in ratio</strong> drop as Lever&nbsp;#1 lands,
        <strong> calls</strong> drop as Lever&nbsp;#1b lands,
        and <strong>cost/call</strong> halve if Lever&nbsp;#6 ships.
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 3" stroke="var(--border-base)" vertical={false} />
          <defs>
            <linearGradient id="cart-cost-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--amber)" stopOpacity={0.9} />
              <stop offset="100%" stopColor="var(--amber)" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="day"
            tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
            width={32}
            domain={[0, 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-elevated)',
              border:           '1px solid var(--border-base)',
              borderRadius:     8,
              fontSize:         11,
              fontFamily:       'var(--font-mono)',
              color:            'var(--text-primary)',
            }}
            labelStyle={{ color: 'var(--text-tertiary)' }}
            formatter={(v, name) => {
              const num = typeof v === 'number' ? v : Number(v);
              if (name === 'cost')          return [`$${num.toFixed(2)}`, 'Cost'];
              if (name === 'calls')         return [num.toLocaleString(), 'Calls'];
              if (name === 'out_in')        return [num.toFixed(2), 'Out:In'];
              if (name === 'cost_per_call') return [`$${num.toFixed(5)}`, 'Cost/call'];
              return [String(num), String(name)];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}
            iconSize={8}
          />
          <Bar  yAxisId="left"  dataKey="cost"   fill="url(#cart-cost-bar)" radius={[2, 2, 0, 0]} />
          <Line yAxisId="right" dataKey="out_in" stroke="var(--sev-critical)" strokeWidth={1.5} dot={false} />
          <Line yAxisId="right" dataKey="cost_per_call" stroke="var(--blue)" strokeWidth={1.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ─── Lever roster ───────────────────────────────────────────────
function LeverRoster({ levers }: { levers: AiCostOptLever[] }) {
  const totalSavings = levers.reduce((s, l) => s + l.estimated_savings_usd_per_year, 0);
  const deployedCount = levers.filter((l) => l.status === 'deployed').length;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <span
          className="font-mono text-[10px] tracking-[0.20em] uppercase font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          Lever roster
        </span>
        <span
          className="font-mono text-[10px]"
          style={{ color: 'var(--text-secondary)' }}
        >
          {deployedCount}/{levers.length} deployed · est. ${totalSavings.toFixed(0)}/yr
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {levers.map((l) => (
          <LeverCard key={l.id} lever={l} />
        ))}
      </div>
    </div>
  );
}

function LeverCard({ lever }: { lever: AiCostOptLever }) {
  const statusColor = lever.status === 'deployed'    ? 'var(--green)'
                    : lever.status === 'in_progress' ? 'var(--amber)'
                    :                                  'var(--text-muted)';
  const statusBg    = lever.status === 'deployed'    ? 'var(--sev-low-bg)'
                    : lever.status === 'in_progress' ? 'var(--sev-medium-bg)'
                    :                                  'var(--bg-input)';

  return (
    <Card variant="elevated" className="p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span
          className="font-mono text-[11px] font-bold uppercase tracking-wide"
          style={{ color: 'var(--text-primary)' }}
        >
          {lever.id.replace('_', ' ')} · {lever.title}
        </span>
        <span
          className="font-mono text-[9px] tracking-[0.15em] uppercase px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ color: statusColor, background: statusBg }}
        >
          {lever.status.replace('_', ' ')}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Stat label="Target agent" value={lever.target_agent} />
        <Stat label="Est. savings" value={`$${lever.estimated_savings_usd_per_year}/yr`} />
      </div>
      <div
        className="font-mono text-[9px] tracking-[0.15em] uppercase mb-1"
        style={{ color: 'var(--text-muted)' }}
      >
        Indicator
      </div>
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {lever.indicator}
      </p>
      {lever.deployed_at && (
        <div
          className="font-mono text-[9px] mt-2"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Deployed {lever.deployed_at.slice(0, 10)}
        </div>
      )}
    </Card>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────
function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <span
        className="font-mono text-[10px] tracking-[0.20em] uppercase font-bold"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </span>
      {count != null && (
        <span
          className="font-mono text-[10px] px-2 py-0.5 rounded"
          style={{
            background: 'var(--bg-input)',
            color:      'var(--text-secondary)',
            border:     '1px solid var(--border-base)',
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function Stat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div
        className="font-mono text-[9px] tracking-[0.15em] uppercase"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </div>
      <div
        className="text-sm font-mono"
        style={{ color: valueColor ?? 'var(--text-primary)' }}
      >
        {value}
      </div>
    </div>
  );
}
