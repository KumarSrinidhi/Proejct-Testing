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
      .then((response) => {
        setSummary(response.data);
      })
      .catch((error) => {
        setMessage(error?.response?.data?.detail || "Failed to load your attendance summary.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="card text-sm">Loading your attendance summary...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-display text-xl mb-2">My Attendance</h2>
        <p className="text-sm text-slate-600">This view is scoped to attendance records linked to your account email.</p>
      </div>
      <div className="grid-auto">
        <div className="card">
          <h3 className="font-display text-lg">Today Total</h3>
          <p className="text-3xl font-bold">{summary.total_today}</p>
        </div>
        <div className="card">
          <h3 className="font-display text-lg">Unique Check-ins</h3>
          <p className="text-3xl font-bold">{summary.unique_today}</p>
        </div>
        <div className="card">
          <h3 className="font-display text-lg">Average Confidence</h3>
          <p className="text-3xl font-bold">{(summary.avg_confidence || 0).toFixed(3)}</p>
        </div>
      </div>
      {message ? <div className="card text-sm">{message}</div> : null}
    </div>
  );
}
