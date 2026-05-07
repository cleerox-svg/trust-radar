export function Notifications() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-[28px] font-bold text-white tracking-tight">Notifications</h1>
      <p className="mt-1 text-sm text-white/55">Per-channel preferences + digest mode + severity floors.</p>
      <div className="mt-6 rounded-xl border border-white/[0.06] bg-bg-card p-6">
        <p className="text-[12px] text-white/55 leading-relaxed">
          Tenant-scoped notifications + alerts are wired in the backend
          (`notification_preferences_v2`) and ready to render — porting the
          UI from averrow-ui in Phase B sprint 2.
        </p>
      </div>
    </div>
  );
}

export function Alerts() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-[28px] font-bold text-white tracking-tight">Alerts</h1>
      <p className="mt-1 text-sm text-white/55">Action-required alerts for your brands.</p>
      <div className="mt-6 rounded-xl border border-white/[0.06] bg-bg-card p-6">
        <p className="text-[12px] text-white/55 leading-relaxed">
          Tenant-scoped alerts surface ports from{' '}
          <code className="text-white/55">/api/orgs/:id/alerts</code> (already wired) in Phase B sprint 2.
        </p>
      </div>
    </div>
  );
}
