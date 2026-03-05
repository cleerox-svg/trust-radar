export default function GeoMapPage() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-lg font-semibold text-radar-text">Geo Map</h1>
        <p className="text-xs text-radar-muted mt-0.5">Geographic distribution of signal origins</p>
      </div>

      <div className="card flex flex-col items-center justify-center py-24 gap-4 border-dashed">
        <div className="w-16 h-16 rounded-full bg-radar-cyan/10 border border-radar-cyan/30 flex items-center justify-center text-2xl">
          ⊕
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-radar-text">Geographic Map</div>
          <div className="text-xs text-radar-muted mt-1 max-w-xs">
            Interactive world map showing signal origin distribution by country and region.
            Coming in the next release.
          </div>
        </div>
        <div className="flex gap-4 mt-2">
          {[
            { label: "Countries", value: "—" },
            { label: "Top Region", value: "—" },
            { label: "Coverage", value: "—" },
          ].map(({ label, value }) => (
            <div key={label} className="stat-card min-w-[90px] text-center !p-3">
              <div className="text-lg font-bold font-mono text-radar-muted">{value}</div>
              <div className="text-[10px] text-radar-muted">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
