import { useEffect, useState } from "react";
import { attendanceApi } from "../services/api";
import TrendChart from "../components/TrendChart";

export default function TrendsPage() {
  const [data, setData] = useState({ attendance_by_department: [], confidence_distribution: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await attendanceApi.trends();
        if (!isMounted) {
          return;
        }
        const next = res?.data || {};
        setData({
          attendance_by_department: next.attendance_by_department || [],
          confidence_distribution: next.confidence_distribution || [],
        });
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(err?.response?.data?.detail || "Failed to load trend data.");
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
    return <div className="card text-sm">Loading trends...</div>;
  }

  return (
    <div className="space-y-4">
      {error ? <div className="card text-sm">{error}</div> : null}
      <TrendChart
        type="bar"
        label="Attendance by Department"
        labels={data.attendance_by_department.map((x) => x.department)}
        values={data.attendance_by_department.map((x) => x.count)}
      />
      <TrendChart
        type="line"
        label="Confidence Distribution"
        labels={data.confidence_distribution.map((x) => `${x.bucket}`)}
        values={data.confidence_distribution.map((x) => x.count)}
      />
    </div>
  );
}
