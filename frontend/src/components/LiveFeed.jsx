export default function LiveFeed({ events = [], onClear }) {
  const formatIst = (value) => {
    if (!value) return "—";
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(new Date(value));
  };

  return (
    <div className="card">
      <div className="section-header">
        <div>
          <div className="section-title">Recognition Events</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.125rem" }}>
            {events.length} event{events.length !== 1 ? "s" : ""} captured
          </div>
        </div>
        <button onClick={onClear} className="btn btn-secondary btn-sm">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/>
            <path d="M14 11v6"/>
          </svg>
          Clear
        </button>
      </div>

      {events.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            style={{ margin: "0 auto 0.75rem", opacity: 0.3 }}>
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
          No events yet — start the live feed to see recognition results
        </div>
      ) : (
        <div style={{ maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {events.map((event, idx) => {
            const isKnown = event.name && event.name !== "Unknown";
            const confidence = event.confidence || 0;
            const confColor = confidence > 0.8 ? "#10b981" : confidence > 0.6 ? "#f59e0b" : "#f43f5e";
            const marked = event.attendance_marked;

            return (
              <div
                key={`${event.timestamp}-${idx}`}
                className="animate-fade-in"
                style={{
                  padding: "0.75rem 0.875rem",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.875rem",
                  animationDelay: "0s",
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: "var(--primary-bg)",
                  border: `1px solid ${isKnown ? "var(--primary)" : "var(--border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.75rem", fontWeight: 700,
                  color: isKnown ? "var(--primary)" : "var(--text-muted)",
                }}>
                  {isKnown ? event.name[0].toUpperCase() : "?"}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: isKnown ? "var(--text-primary)" : "var(--text-muted)", fontSize: "0.875rem" }}>
                    {event.name || "Unknown"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                    {event.message}
                  </div>
                </div>

                {/* Confidence */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 700, color: confColor, fontFamily: "var(--mono, monospace)" }}>
                    {(confidence * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{formatIst(event.timestamp)}</div>
                </div>

                {/* Attendance badge */}
                {marked !== undefined && (
                  <span className={`badge ${marked ? "badge-emerald" : "badge-slate"}`} style={{ flexShrink: 0, fontSize: "0.65rem" }}>
                    {marked ? "Marked" : "Skipped"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
