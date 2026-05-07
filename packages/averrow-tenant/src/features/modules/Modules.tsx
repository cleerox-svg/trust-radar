// averrow-tenant — Overview / Modules dashboard.
//
// One round-trip surface: status of every module the tenant has,
// this-month usage rollup per module, and the takedown authorization
// summary. Drives both the "active modules" grid and the
// "available to unlock" upsell list off a single fetch (handler:
// trust-radar/src/handlers/tenantModules.ts).

import { useTenantModules, MODULE_LABELS, MODULE_DESCRIPTIONS, type ModuleKey, type TenantModuleSurface } from '@/lib/modules';
import { useAuth } from '@/lib/auth';
import { Link } from 'react-router-dom';
import { CheckCircle2, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';

const MODULE_PATHS: Record<ModuleKey, string> = {
  domain:        '/modules/domain',
  social:        '/modules/social',
  app_store:     '/modules/app-store',
  dark_web:      '/modules/dark-web',
  abuse_mailbox: '/modules/abuse-mailbox',
  trademark:     '/modules/trademark',
  threat_actor:  '/modules/threat-actor',
};

export function Modules() {
  const { user, hasOrg, loading: authLoading } = useAuth();
  const { data, isLoading, error } = useTenantModules();

  if (authLoading) return <Loading />;
  if (!user) return <NotAuthenticated />;
  if (!hasOrg) return <NoOrg />;
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error.message} />;
  if (!data) return null;

  const active = data.modules.filter((m) => m.status === 'active' || m.status === 'trial');
  const locked = data.modules.filter((m) => m.status === 'not_entitled' || m.status === 'suspended');

  return (
    <div className="space-y-8 max-w-6xl">
      <header>
        <h1 className="text-[28px] font-bold text-white tracking-tight">Workspace overview</h1>
        <p className="mt-1 text-sm text-white/55">
          {user.organization?.name ?? 'Your organization'} — {active.length} module{active.length === 1 ? '' : 's'} active
        </p>
      </header>

      <AuthorizationBadge data={data.takedown_authorization} />

      <section>
        <h2 className="text-[11px] uppercase tracking-[0.18em] font-mono text-white/45 mb-3">Active modules</h2>
        {active.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-bg-card p-6 text-center">
            <p className="text-white/55 text-sm">No modules active yet.</p>
            <p className="text-white/35 text-xs mt-1">A super-admin needs to activate modules for your organization.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {active.map((m) => (
              <ModuleCard key={m.module_key} module={m} entitled />
            ))}
          </div>
        )}
      </section>

      {locked.length > 0 && (
        <section>
          <h2 className="text-[11px] uppercase tracking-[0.18em] font-mono text-white/45 mb-3">Available to add</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {locked.map((m) => (
              <ModuleCard key={m.module_key} module={m} entitled={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ModuleCard({ module: m, entitled }: { module: TenantModuleSurface; entitled: boolean }) {
  const totalUsage = m.metrics.reduce((sum, metric) => sum + (metric.value_this_month ?? 0), 0);
  const trial = m.status === 'trial';

  return (
    <Link
      to={MODULE_PATHS[m.module_key]}
      className={cn(
        'block rounded-xl border bg-bg-card p-4 transition-colors',
        entitled
          ? 'border-white/[0.06] hover:border-amber/[0.30]'
          : 'border-white/[0.04] hover:border-white/[0.10] opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="text-sm font-semibold text-white/90">{MODULE_LABELS[m.module_key]}</div>
          <p className="text-[11px] text-white/45 mt-1 leading-relaxed">{MODULE_DESCRIPTIONS[m.module_key]}</p>
        </div>
        {entitled ? (
          <span className="flex items-center gap-1 text-[9px] uppercase tracking-widest font-mono text-amber">
            <CheckCircle2 size={11} />
            {trial ? 'Trial' : 'Active'}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[9px] uppercase tracking-widest font-mono text-white/35">
            <Lock size={11} />
            Locked
          </span>
        )}
      </div>

      {entitled && m.metrics.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/[0.04]">
          <div className="text-[9px] uppercase tracking-widest font-mono text-white/35 mb-1">This month</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white/90 tabular-nums">{totalUsage}</span>
            <span className="text-[10px] text-white/45">across {m.metrics.length} metric{m.metrics.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      )}
    </Link>
  );
}

function AuthorizationBadge({ data }: { data: { signed: boolean; modules_covered?: ModuleKey[] | undefined } }) {
  if (data.signed) {
    return (
      <div className="rounded-xl border border-green/[0.20] bg-green/[0.06] p-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white/90">Takedown authorization signed</div>
          <p className="text-[11px] text-white/55 mt-0.5">
            Coverage: {data.modules_covered?.length ?? 0} module{(data.modules_covered?.length ?? 0) === 1 ? '' : 's'}.
            Automated takedowns are running on your behalf within scope.
          </p>
        </div>
        <Link to="/settings/takedown-authorization" className="text-[11px] font-mono text-amber hover:underline">
          Manage →
        </Link>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-amber/[0.30] bg-amber/[0.06] p-4 flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-white/90">Sign your takedown authorization</div>
        <p className="text-[11px] text-white/55 mt-0.5">
          Without your signed authorization, takedowns can be detected but not submitted automatically.
        </p>
      </div>
      <Link to="/settings/takedown-authorization" className="text-[11px] font-mono text-amber hover:underline">
        Sign →
      </Link>
    </div>
  );
}

function Loading() {
  return <div className="text-white/40 text-sm font-mono py-12 text-center">Loading…</div>;
}

function NotAuthenticated() {
  return (
    <div className="max-w-md mx-auto py-16 text-center">
      <h1 className="text-xl font-semibold text-white mb-2">Sign in required</h1>
      <p className="text-sm text-white/55">
        Your session has expired. <a href="/v2/login" className="text-amber hover:underline">Sign in to continue</a>.
      </p>
    </div>
  );
}

function NoOrg() {
  return (
    <div className="max-w-md mx-auto py-16 text-center">
      <h1 className="text-xl font-semibold text-white mb-2">No organization yet</h1>
      <p className="text-sm text-white/55">
        Your account isn't bound to an organization. Contact your admin or{' '}
        <a href="mailto:support@averrow.com" className="text-amber hover:underline">support@averrow.com</a>.
      </p>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="max-w-md mx-auto py-16 text-center">
      <h1 className="text-xl font-semibold text-white mb-2">Couldn't load your workspace</h1>
      <p className="text-sm text-white/55">{error}</p>
    </div>
  );
}
