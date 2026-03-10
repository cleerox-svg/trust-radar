import { useQuery } from "@tanstack/react-query";
import { threats, dashboard } from "../lib/api";
import { Card, CardContent } from "../components/ui";

const countryNames: Record<string, string> = {
  US: "United States", CN: "China", RU: "Russia", DE: "Germany", GB: "United Kingdom",
  FR: "France", IN: "India", BR: "Brazil", JP: "Japan", KR: "South Korea",
  CA: "Canada", AU: "Australia", NL: "Netherlands", UA: "Ukraine", IR: "Iran",
  NG: "Nigeria", PH: "Philippines", VN: "Vietnam", RO: "Romania", ID: "Indonesia",
  TH: "Thailand", TR: "Turkey", PL: "Poland", EG: "Egypt", SA: "Saudi Arabia",
  MX: "Mexico", KP: "North Korea", PK: "Pakistan", BD: "Bangladesh", ZA: "South Africa",
  IT: "Italy", ES: "Spain", SE: "Sweden", SG: "Singapore", HK: "Hong Kong",
};

const barColor = (count: number, max: number) => {
  const pct = max > 0 ? count / max : 0;
  if (pct >= 0.7) return "bg-threat-critical";
  if (pct >= 0.4) return "bg-threat-high";
  if (pct >= 0.15) return "bg-threat-medium";
  return "bg-cyan-500";
};

const riskColor = (count: number, max: number) => {
  const pct = max > 0 ? count / max : 0;
  if (pct >= 0.7) return "text-threat-critical";
  if (pct >= 0.4) return "text-threat-high";
  if (pct >= 0.15) return "text-threat-medium";
  return "text-[--text-secondary]";
};

const regionMap: Record<string, string> = {
  US: "North America", CA: "North America", MX: "Latin America", BR: "Latin America",
  GB: "Europe", DE: "Europe", FR: "Europe", NL: "Europe", PL: "Europe", RO: "Europe",
  IT: "Europe", ES: "Europe", SE: "Europe", UA: "Europe", TR: "Europe",
  CN: "Asia Pacific", JP: "Asia Pacific", KR: "Asia Pacific", IN: "Asia Pacific",
  VN: "Asia Pacific", TH: "Asia Pacific", ID: "Asia Pacific", PH: "Asia Pacific",
  SG: "Asia Pacific", HK: "Asia Pacific", AU: "Asia Pacific", BD: "Asia Pacific", PK: "Asia Pacific",
  RU: "Eastern Europe/CIS", KP: "Eastern Europe/CIS",
  NG: "Africa", ZA: "Africa", EG: "Africa",
  IR: "Middle East", SA: "Middle East",
};

export default function GeoMapPage() {
  const { data: threatStats } = useQuery({ queryKey: ["threat-stats"], queryFn: threats.stats });
  const { data: sources } = useQuery({ queryKey: ["dashboard-sources"], queryFn: dashboard.sources });

  const byCountry = threatStats?.byCountry ?? [];
  const maxCount = byCountry.length > 0 ? Math.max(...byCountry.map((c) => c.count)) : 0;
  const totalCountries = byCountry.length;
  const totalThreats = byCountry.reduce((s, c) => s + c.count, 0);
  const topCountry = byCountry[0] ?? null;

  const regions: Record<string, { countries: number; threats: number }> = {};
  byCountry.forEach((c) => {
    const region = regionMap[c.country_code] ?? "Other";
    if (!regions[region]) regions[region] = { countries: 0, threats: 0 };
    regions[region].countries++;
    regions[region].threats += c.count;
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Geo Map</h1>
        <p className="text-sm text-[--text-secondary]">Geographic distribution of threat intelligence origins</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Countries", value: totalCountries, color: "text-cyan-400" },
          { label: "Total Threats", value: totalThreats },
          { label: "Top Origin", value: topCountry ? (countryNames[topCountry.country_code] ?? topCountry.country_code) : "—", isText: true },
          { label: "Regions", value: Object.keys(regions).length, color: "text-cyan-400" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent>
              <div className="text-xs text-[--text-tertiary]">{c.label}</div>
              <div className={`${c.isText ? "text-sm" : "text-2xl"} font-bold tabular-nums ${c.color ?? "text-[--text-primary]"}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Region breakdown */}
      {Object.keys(regions).length > 0 && (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Regional Distribution</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {Object.entries(regions).sort((a, b) => b[1].threats - a[1].threats).map(([region, data]) => {
                const pct = totalThreats > 0 ? Math.round((data.threats / totalThreats) * 100) : 0;
                return (
                  <div key={region} className="p-3 rounded-lg bg-[--surface-base] border border-[--border-subtle]">
                    <div className="text-xs font-medium text-[--text-primary] mb-1 truncate">{region}</div>
                    <div className="text-lg font-bold text-cyan-400 tabular-nums">{data.threats}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-[--surface-void] rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-[--text-tertiary] tabular-nums">{pct}%</span>
                    </div>
                    <div className="text-[10px] text-[--text-tertiary] mt-1">{data.countries} countries</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Country table */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Country Origins ({byCountry.length})</h3>
          {byCountry.length === 0 ? (
            <div className="text-sm text-[--text-tertiary] py-8 text-center">No geographic data available</div>
          ) : (
            <div className="space-y-2">
              {byCountry.map((c) => {
                const pct = maxCount > 0 ? Math.round((c.count / maxCount) * 100) : 0;
                const name = countryNames[c.country_code] ?? c.country_code;
                return (
                  <div key={c.country_code} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-[--text-tertiary] w-8">{c.country_code}</span>
                    <span className="text-xs text-[--text-primary] w-32 truncate">{name}</span>
                    <div className="flex-1 h-3 bg-[--surface-base] rounded overflow-hidden">
                      <div className={`h-full ${barColor(c.count, maxCount)} rounded transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-xs font-bold tabular-nums w-12 text-right ${riskColor(c.count, maxCount)}`}>{c.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Source mix */}
      {sources && sources.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Signal Source Origins</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {sources.map((src) => (
                <div key={src.name} className="p-3 rounded-lg bg-[--surface-base] border border-[--border-subtle]">
                  <div className="text-xs text-[--text-tertiary] truncate">{src.name}</div>
                  <div className="text-lg font-bold text-[--text-primary] tabular-nums">{src.count}</div>
                  <div className="text-[10px] text-[--text-tertiary]">{src.percentage}%</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
