import { useMemo } from 'react';
import { threatTypeColor } from '@/lib/severityColor';

interface Brand {
  top_threat_type: string | null;
}

interface Props {
  brands: Brand[];
}

export function AttackVectorsCard({ brands }: Props) {
  const vectors = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of brands) {
      const t = b.top_threat_type;
      if (t) counts[t] = (counts[t] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [brands]);

  const maxCount = vectors.length > 0 ? vectors[0][1] : 1;

  return (
    <div className="rounded-xl border border-white/10 bg-cockpit p-3">
      <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-contrail/70 mb-3 block">
        Attack Vectors
      </span>

      {vectors.length === 0 ? (
        <p className="font-mono text-[10px] text-white/30 py-4 text-center">
          No data
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {vectors.map(([type, count]) => (
            <div key={type} className="flex items-center gap-2">
              <span className="text-[10px] text-white/60 w-20 truncate font-mono">
                {type.replace(/_/g, ' ')}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(count / maxCount) * 100}%`,
                    background: threatTypeColor(type),
                  }}
                />
              </div>
              <span className="text-[10px] font-mono text-white/40 w-12 text-right">
                {count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
