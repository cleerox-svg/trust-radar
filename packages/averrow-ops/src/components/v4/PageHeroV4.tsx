// Shared cinematic page hero for the v4 Intelligence surfaces.
//
// Generalized from OverviewV4's V4Hero/KpiTile so list pages (Providers,
// Threat Actors, Brands, …) get the same command-center header — a mono
// crumb, a bold glowing title, a LIVE pulse, and an optional glowing
// count-up KPI grid — without each page re-implementing it.
//
// Reuse-and-restyle: pages keep ALL their existing body logic and only
// swap their old PageHeader + StatGrid for this when the v4 shell is
// active. The classic shell renders the original header untouched.
import CountUp from 'react-countup';
import '@/features/console/console.css';

export type HeroKpi = {
  tone: 'amber' | 'red' | 'blue' | 'green';
  label: string;
  /** null → renders an em-dash (loading / unknown). */
  value: number | null;
  sub?: string;
};

function KpiTile({ tone, label, value, sub }: HeroKpi) {
  return (
    <div className={`kpi-v4 ${tone}`}>
      <div className="kpi-glow" aria-hidden />
      <div className="kpi-lbl">{label}</div>
      <div className="kpi-num">
        {value == null ? '—' : <CountUp end={value} duration={1.1} separator="," />}
      </div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export function PageHeroV4({
  crumb,
  title,
  kpis,
  live = true,
}: {
  crumb: string;
  title: string;
  kpis?: HeroKpi[];
  live?: boolean;
}) {
  return (
    <div className="console-v4" style={{ padding: '4px 0 0' }}>
      <div className="console-head">
        <div>
          <div className="console-crumb">{crumb}</div>
          <h1 className="console-title">{title}</h1>
        </div>
        {live && (
          <span className="console-live">
            <span className="dot" />
            LIVE
          </span>
        )}
      </div>
      {kpis && kpis.length > 0 && (
        <div className="kpi-grid">
          {kpis.map((k) => (
            <KpiTile key={k.label} {...k} />
          ))}
        </div>
      )}
    </div>
  );
}
