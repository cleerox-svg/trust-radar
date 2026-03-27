import type { Brand } from '@/hooks/useBrands';
import { threatTypeColor } from '@/lib/severityColor';

interface AttackVectorsCardProps {
  brands: Brand[];
}

export function AttackVectorsCard({ brands }: AttackVectorsCardProps) {
  const counts: Record<string, number> = {};
  for (const b of brands) {
    const t = b.top_threat_type;
    if (t) {
      counts[t] = (counts[t] || 0) + 1;
    }
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const max = sorted.length > 0 ? sorted[0][1] : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-cockpit p-4">
      <div className="mb-3 font-mono text-[9px] uppercase tracking-widest text-contrail/70">
        Attack Vectors
      </div>

      {sorted.length === 0 ? (
        <p className="text-[11px] text-white/30">No threat data</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map(([type, count]) => {
            const color = threatTypeColor(type);
            const widthPct = max > 0 ? (count / max) * 100 : 0;
            return (
              <div key={type} className="flex items-center gap-2">
                <span className="w-20 flex-shrink-0 font-mono text-[10px] text-white/60">
                  {type}
                </span>
                <div className="flex-1">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${widthPct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="w-12 flex-shrink-0 text-right font-mono text-[10px] text-white/40">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
