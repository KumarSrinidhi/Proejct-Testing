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
        if (!isMounted) {
          return;
        }
        const next = res?.data || {};
        setData({
          hourly: next.hourly || {},
          daily: next.daily || {},
        });
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(err?.response?.data?.detail || "Failed to load heatmap data.");
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
    return <div className="card text-sm">Loading heatmap...</div>;
  }

  return (
    <div className="space-y-4">
      {error ? <div className="card text-sm">{error}</div> : null}
      <AttendanceHeatmap title="Hourly Pattern" data={data.hourly} />
      <AttendanceHeatmap title="Daily Pattern" data={data.daily} />
    </div>
  );
}
