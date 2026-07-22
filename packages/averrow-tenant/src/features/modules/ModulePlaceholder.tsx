// One placeholder per module. Renders the module's status, this-
// month metrics, and a "wiring up in Phase B" callout. Per-module
// real surfaces (Domain map, Social impersonator queue, etc.) port
// in as each module ships.

import { useTenantModules, MODULE_LABELS, MODULE_DESCRIPTIONS, type ModuleKey } from '@/lib/modules';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function ModulePlaceholder({ moduleKey }: { moduleKey: ModuleKey }) {
  const { data, isLoading } = useTenantModules();

  const module = data?.modules.find((m) => m.module_key === moduleKey);
  const status = module?.status ?? 'not_entitled';
  const entitled = status === 'active' || status === 'trial';

  return (
    <div className="max-w-4xl space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-[11px] font-mono text-white/40 hover:text-white/70">
        <ArrowLeft size={12} />
        BACK TO OVERVIEW
      </Link>

      <header>
        <h1 className="text-[28px] font-bold text-[var(--text-primary)] tracking-tight">{MODULE_LABELS[moduleKey]}</h1>
        <p className="mt-1 text-sm text-white/55 max-w-2xl">{MODULE_DESCRIPTIONS[moduleKey]}</p>
        <div className="mt-2">
          {isLoading ? (
            <span className="text-[10px] uppercase tracking-widest font-mono text-white/30">Loading…</span>
          ) : entitled ? (
            <span className="inline-flex items-center text-[10px] uppercase tracking-widest font-mono text-amber bg-amber/[0.10] border border-amber/[0.20] rounded px-2 py-1">
              {status === 'trial' ? 'Trial' : 'Active'}
            </span>
          ) : (
            <span className="inline-flex items-center text-[10px] uppercase tracking-widest font-mono text-white/40 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1">
              {status === 'suspended' ? 'Suspended' : 'Not entitled'}
            </span>
          )}
        </div>
      </header>

      {entitled && module && module.metrics.length > 0 && (
        <section>
          <h2 className="text-[11px] uppercase tracking-[0.18em] font-mono text-white/45 mb-3">This month</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {module.metrics.map((m) => (
              <div key={m.metric_key} className="rounded-xl border border-white/[0.06] bg-bg-card p-4">
                <div className="text-[10px] uppercase tracking-widest font-mono text-white/40 mb-1">{m.label}</div>
                <div className="text-3xl font-bold text-white/95 tabular-nums">{m.value_this_month}</div>
                {m.description && (
                  <p className="text-[11px] text-white/40 mt-2 leading-relaxed">{m.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-white/[0.06] bg-bg-card p-6">
        <h3 className="text-sm font-semibold text-white/90 mb-1">Surface coming in Phase B</h3>
        <p className="text-[12px] text-white/55 leading-relaxed">
          The dedicated {MODULE_LABELS[moduleKey].toLowerCase()} surface is wiring up in v3 Phase B.
          Today the platform is collecting and classifying the underlying data — usage above is real.
          When the per-module workflow lands, you'll see findings, takedown actions, and history here.
        </p>
        {!entitled && (
          <p className="text-[12px] text-amber/80 mt-3">
            Your organization isn't entitled to this module yet. Contact{' '}
            <a href="mailto:support@averrow.com" className="text-amber hover:underline">support@averrow.com</a>{' '}
            to add it.
          </p>
        )}
      </section>
    </div>
  );
}
