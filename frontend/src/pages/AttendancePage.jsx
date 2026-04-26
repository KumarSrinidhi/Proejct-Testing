import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { attendanceApi } from "../services/api";

export default function AttendancePage() {
  const [records, setRecords] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const { role, isAdmin } = useAuth();
  const isStudent = role === "student";
  const pageSize = 20;

  const load = async () => {
    setLoading(true);
    try {
      const request = isStudent
        ? attendanceApi.listMine({ page, page_size: pageSize })
        : attendanceApi.list({ page, page_size: pageSize, search });
      const { data } = await request;
      const items = data?.items || data || [];
      setRecords(items);
      setTotalRecords(data?.total ?? items.length);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to load attendance records.");
      setRecords([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, search, isStudent]);

  const exportCsv = async () => {
    if (!isAdmin) return;
    const { data } = await attendanceApi.exportCsv();
    const url = window.URL.createObjectURL(new Blob([data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = "attendance.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const deleteRecord = async (id) => {
    if (!isAdmin) return;
    const confirmed = window.confirm("Delete this attendance record?");
    if (!confirmed) return;

    setDeletingId(id);
    setMessage("");
    try {
      await attendanceApi.remove(id);
      setMessage("Attendance record deleted successfully.");
      await load();
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to delete attendance record.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="font-display text-lg">Attendance Logs</h3>
        <div className="flex items-center gap-2">
          {!isStudent ? (
            <input
              className="border rounded p-2 text-sm"
              placeholder="Search name or department"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          ) : null}
          {isAdmin ? (
            <button onClick={exportCsv} className="rounded bg-accent text-white px-3 py-2">Export CSV</button>
          ) : null}
        </div>
      </div>
      {message ? <div className="mb-3 text-sm">{message}</div> : null}
      <div className="mb-2 text-xs text-slate-600">Showing {records.length} of {totalRecords}</div>
      {loading ? <div className="mb-2 text-sm">Loading attendance...</div> : null}
      {!loading && records.length === 0 ? <div className="mb-2 text-sm">No attendance records found.</div> : null}
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Name</th>
              <th className="p-2">Department</th>
              <th className="p-2">Timestamp</th>
              <th className="p-2">Confidence</th>
              {isAdmin ? <th className="p-2">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {records.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-2">{row.person_name}</td>
                <td className="p-2">{row.department}</td>
                <td className="p-2">{new Date(row.timestamp).toLocaleString()}</td>
                <td className="p-2">{row.confidence_score.toFixed(3)}</td>
                {isAdmin ? (
                  <td className="p-2">
                    <button
                      className="rounded bg-red-600 text-white px-2 py-1"
                      onClick={() => deleteRecord(row.id)}
                      disabled={deletingId === row.id}
                    >
                      {deletingId === row.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span>Page {page}</span>
        <div className="flex gap-2">
          <button type="button" className="rounded bg-slate-700 text-white px-3 py-2" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1 || loading}>
            Previous
          </button>
          <button type="button" className="rounded bg-slate-700 text-white px-3 py-2" onClick={() => setPage((prev) => prev + 1)} disabled={loading || records.length < pageSize || page * pageSize >= totalRecords}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
