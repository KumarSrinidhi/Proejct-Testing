export default function ConfidenceIndicator({ value = 0 }) {
  const pct = Math.round(value * 100);
  const color = value > 0.8 ? "#10b981" : value > 0.6 ? "#f59e0b" : "#f43f5e";
  const label = value > 0.8 ? "High" : value > 0.6 ? "Medium" : "Low";
  const badgeCls = value > 0.8 ? "badge-emerald" : value > 0.6 ? "badge-amber" : "badge-rose";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.625rem" }}>
        <div className="label">Avg. Confidence</div>
        <span className={`badge ${badgeCls}`}>{label}</span>
      </div>
      <div style={{
        width: "100%", height: 8,
        background: "rgba(255,255,255,0.06)",
        borderRadius: 100, overflow: "hidden",
        marginBottom: "0.375rem",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: color,
          borderRadius: 100,
          transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          boxShadow: `0 0 8px ${color}`,
        }} />
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color, lineHeight: 1.2, letterSpacing: "-0.02em" }}>
        {pct}<span style={{ fontSize: "1rem", fontWeight: 600, marginLeft: 2 }}>%</span>
      </div>
    </div>
  );
}
