import { useEffect, useState } from "react";
import { attendanceApi } from "../services/api";
import TrendChart from "../components/TrendChart";
import ConfidenceIndicator from "../components/ConfidenceIndicator";

const statCards = [
  {
    key: "total_today",
    label: "Total Scans Today",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    color: "var(--primary)",
    bg: "var(--primary-bg)",
    border: "var(--border-subtle)",
  },
  {
    key: "unique_today",
    label: "Unique People",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    color: "var(--success)",
    bg: "var(--success-bg)",
    border: "var(--border-subtle)",
  },
];

export default function Dashboard() {
  const [today, setToday] = useState({ total_today: 0, unique_today: 0, avg_confidence: 0 });
  const [heatmap, setHeatmap] = useState({ weekly_trend: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const [todayRes, heatmapRes] = await Promise.all([
          attendanceApi.today(),
          attendanceApi.heatmap(),
        ]);
        if (!isMounted) return;
        setToday(todayRes?.data || { total_today: 0, unique_today: 0, avg_confidence: 0 });
        setHeatmap(heatmapRes?.data || { weekly_trend: [] });
      } catch (err) {
        if (!isMounted) return;
        setError(err?.response?.data?.detail || "Failed to load dashboard data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div style={{ marginBottom: "0.25rem" }}>
          <div className="skeleton" style={{ width: 180, height: 28, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 240, height: 16 }} />
        </div>
        <div className="grid-stats">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 96, borderRadius: 14 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 240, borderRadius: 14 }} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Page Header */}
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
          Real-time attendance overview for today
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-danger animate-fade-in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid-stats">
        {statCards.map((stat, i) => (
          <div
            key={stat.key}
            className="stat-card animate-fade-in"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: stat.bg,
                  border: `1px solid ${stat.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: stat.color,
                }}
              >
                {stat.icon}
              </div>
              <div className="badge badge-slate">Today</div>
            </div>
            <div className="value-lg" style={{ color: stat.color, marginBottom: "0.25rem" }}>
              {today[stat.key] ?? 0}
            </div>
            <div className="label">{stat.label}</div>
          </div>
        ))}

        {/* Confidence Card */}
        <div className="stat-card animate-fade-in" style={{ animationDelay: "0.16s" }}>
          <div className="label mb-3">Avg. Confidence</div>
          <ConfidenceIndicator value={today.avg_confidence || 0} />
        </div>
      </div>

      {/* Trend Chart */}
      <div className="card animate-fade-in" style={{ animationDelay: "0.24s" }}>
        <div className="section-header">
          <div>
            <div className="section-title mb-1">Weekly Attendance Trend</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Daily scan counts for the past 7 days
            </div>
          </div>
          {heatmap.weekly_trend?.length > 0 && (
            <div className="badge badge-emerald">
              {heatmap.weekly_trend.reduce((a, b) => a + b, 0)} total
            </div>
          )}
        </div>
        <TrendChart
          label="Weekly Attendance"
          labels={(heatmap.weekly_trend || []).map((_, i) => `Day ${i + 1}`)}
          values={heatmap.weekly_trend || []}
        />
      </div>
    </div>
  );
}
