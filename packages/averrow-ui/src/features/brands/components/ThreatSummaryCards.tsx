interface ThreatSummary {
  type: string;
  count: number;
  label: string;
  color: string;
}

export function ThreatSummaryCards({ threats }: { threats: any[] }) {
  // Aggregate by type
  const typeCounts: Record<string, number> = {};
  threats.forEach(t => {
    const type = t.threat_type || 'unknown';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });

  const typeConfig: Record<string, { label: string; color: string }> = {
    phishing: { label: 'Phishing', color: '#C83C3C' },
    malware_distribution: { label: 'Malware', color: '#E8923C' },
    typosquatting: { label: 'Typosquat', color: '#DCAA32' },
    credential_harvesting: { label: 'Credential', color: '#C85078' },
    impersonation: { label: 'Impersonation', color: '#7850C8' },
    c2: { label: 'C2', color: '#78A0C8' },
  };

  const cards: ThreatSummary[] = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([type, count]) => ({
      type,
      count,
      label: typeConfig[type]?.label || type.replace(/_/g, ' '),
      color: typeConfig[type]?.color || '#78A0C8',
    }));

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(card => (
        <div key={card.type}
          className="bg-instrument border border-white/[0.06] rounded-lg p-4 transition-all hover:border-white/10"
          style={{ borderTopWidth: '3px', borderTopColor: card.color }}
        >
          <div className="font-display text-2xl font-extrabold" style={{ color: card.color }}>{card.count}</div>
          <div className="font-mono text-[10px] text-contrail/50 uppercase tracking-wider mt-1">{card.label}</div>
        </div>
      ))}
    </div>
  );
}
