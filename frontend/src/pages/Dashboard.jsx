import { useEffect, useState } from "react";
import { attendanceApi } from "../services/api";
import TrendChart from "../components/TrendChart";
import ConfidenceIndicator from "../components/ConfidenceIndicator";

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
        const [todayRes, heatmapRes] = await Promise.all([attendanceApi.today(), attendanceApi.heatmap()]);
        if (!isMounted) {
          return;
        }
        setToday(todayRes?.data || { total_today: 0, unique_today: 0, avg_confidence: 0 });
        setHeatmap(heatmapRes?.data || { weekly_trend: [] });
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(err?.response?.data?.detail || "Failed to load dashboard data.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    run();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <div className="card text-sm">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-4">
      {error ? <div className="card text-sm">{error}</div> : null}
      <div className="grid-auto">
        <div className="card"><h2 className="font-display text-lg">Today Total</h2><p className="text-3xl font-bold">{today.total_today}</p></div>
        <div className="card"><h2 className="font-display text-lg">Unique People</h2><p className="text-3xl font-bold">{today.unique_today}</p></div>
        <ConfidenceIndicator value={today.avg_confidence || 0} />
      </div>
      <TrendChart
        label="Weekly Attendance"
        labels={(heatmap.weekly_trend || []).map((_, i) => `D${i + 1}`)}
        values={heatmap.weekly_trend || []}
      />
    </div>
  );
}
