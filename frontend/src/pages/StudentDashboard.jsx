import { useEffect, useState } from "react";
import { attendanceApi } from "../services/api";

export default function StudentDashboard() {
  const [summary, setSummary] = useState({ total_today: 0, unique_today: 0, avg_confidence: 0 });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    attendanceApi
      .todayMine()
      .then((response) => setSummary(response.data))
      .catch((error) => setMessage(error?.response?.data?.detail || "Failed to load your attendance summary."))
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    {
      label: "Scans Today",
      value: summary.total_today,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      color: "var(--primary)",
      bg: "var(--primary-bg)",
      border: "var(--border-subtle)",
    },
    {
      label: "Unique Check-ins",
      value: summary.unique_today,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      ),
      color: "var(--success)",
      bg: "var(--success-bg)",
      border: "var(--border-subtle)",
    },
    {
      label: "Avg. Confidence",
      value: (summary.avg_confidence || 0).toFixed(3),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
          <polyline points="17 6 23 6 23 12"/>
        </svg>
      ),
      color: "var(--primary)",
      bg: "var(--primary-bg)",
      border: "var(--border-subtle)",
    },
  ];

  if (loading) {
    return (
      <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <div className="skeleton" style={{ width: 180, height: 28, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 280, height: 16 }} />
        </div>
        <div className="grid-stats">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 14 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div>
        <h1 className="page-title">My Attendance</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
          Your personal attendance overview scoped to your account
        </p>
      </div>

      {/* Info banner */}
      <div className="alert alert-info">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        This view shows attendance records linked to your registered email address only.
      </div>

      {/* Stats */}
      <div className="grid-stats">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="stat-card animate-fade-in"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: stat.bg,
                border: `1px solid ${stat.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: stat.color,
              }}>
                {stat.icon}
              </div>
              <div className="badge badge-slate">Today</div>
            </div>
            <div className="value-lg" style={{ color: stat.color, marginBottom: "0.25rem" }}>
              {stat.value}
            </div>
            <div className="label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Error */}
      {message && (
        <div className="alert alert-danger animate-fade-in">{message}</div>
      )}
    </div>
  );
}
