import { useEffect, useState } from "react";
import { attendanceApi } from "../services/api";
import AttendanceHeatmap from "../components/Heatmap";

export default function HeatmapPage() {
  const [data, setData] = useState({ hourly: {}, daily: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await attendanceApi.heatmap();
        if (!isMounted) return;
        const next = res?.data || {};
        setData({ hourly: next.hourly || {}, daily: next.daily || {} });
      } catch (err) {
        if (!isMounted) return;
        setError(err?.response?.data?.detail || "Failed to load heatmap data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1 className="page-title">Attendance Heatmap</h1>
        <p style={{ color: "var(--text-3)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
          Hourly and daily attendance patterns visualized as heatmaps
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="skeleton" style={{ height: 200, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 200, borderRadius: 14 }} />
        </div>
      ) : (
        <>
          <div className="card animate-fade-in">
            <div className="section-title mb-3">Hourly Pattern</div>
            <AttendanceHeatmap data={data.hourly} />
          </div>
          <div className="card animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <div className="section-title mb-3">Daily Pattern</div>
            <AttendanceHeatmap data={data.daily} />
          </div>
        </>
      )}
    </div>
  );
}
