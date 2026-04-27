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
        if (!isMounted) return;
        const next = res?.data || {};
        setData({
          attendance_by_department: next.attendance_by_department || [],
          confidence_distribution: next.confidence_distribution || [],
        });
      } catch (err) {
        if (!isMounted) return;
        setError(err?.response?.data?.detail || "Failed to load trend data.");
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
        <h1 className="page-title">Trends & Analytics</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
          Attendance patterns by department and confidence distribution
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
        </div>
      ) : (
        <>
          <div className="card animate-fade-in">
            <div className="section-title mb-1">Attendance by Department</div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "1rem" }}>
              Total check-ins grouped by department
            </p>
            <TrendChart
              type="bar"
              label="Attendance by Department"
              labels={data.attendance_by_department.map((x) => x.department)}
              values={data.attendance_by_department.map((x) => x.count)}
            />
          </div>

          <div className="card animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <div className="section-title mb-1">Confidence Distribution</div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "1rem" }}>
              Face recognition confidence score distribution
            </p>
            <TrendChart
              type="line"
              label="Confidence Distribution"
              labels={data.confidence_distribution.map((x) => `${x.bucket}`)}
              values={data.confidence_distribution.map((x) => x.count)}
            />
          </div>
        </>
      )}
    </div>
  );
}
