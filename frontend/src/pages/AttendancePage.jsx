import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { attendanceApi, attendanceExceptionApi } from "../services/api";

const EXCEPTION_TYPES = [
  { value: "late", label: "Late", cls: "badge-amber" },
  { value: "excused", label: "Excused", cls: "badge-cyan" },
  { value: "manual_adjustment", label: "Manual", cls: "badge-violet" },
  { value: "absence", label: "Absence", cls: "badge-rose" },
];

function ConfidencePill({ value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#f43f5e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div className="confidence-track">
        <div className="confidence-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span style={{ fontSize: "0.75rem", color, fontWeight: 600, fontFamily: "var(--mono, monospace)" }}>
        {value.toFixed(3)}
      </span>
    </div>
  );
}

export default function AttendancePage() {
  const [records, setRecords] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState({ text: "", type: "info" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exceptions, setExceptions] = useState([]);
  const [exceptionsLoading, setExceptionsLoading] = useState(true);
  const [exceptionMessage, setExceptionMessage] = useState("");
  const [exceptionReason, setExceptionReason] = useState("Marked manually from attendance page");
  const { role, isAdmin } = useAuth();
  const isStudent = role === "student";
  const pageSize = 20;

  const setMsg = (text, type = "info") => setMessage({ text, type });

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
      setMsg(error?.response?.data?.detail || "Failed to load attendance records.", "danger");
      setRecords([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, search, isStudent]);

  const loadExceptions = async () => {
    if (!isAdmin) return;
    setExceptionsLoading(true);
    setExceptionMessage("");
    try {
      const { data } = await attendanceExceptionApi.list({ page: 1, page_size: 20 });
      setExceptions(data?.items || data || []);
    } catch (error) {
      setExceptionMessage(error?.response?.data?.detail || "Failed to load exceptions.");
      setExceptions([]);
    } finally {
      setExceptionsLoading(false);
    }
  };

  useEffect(() => { loadExceptions(); }, [isAdmin]);

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
    if (!window.confirm("Delete this attendance record?")) return;
    setDeletingId(id);
    setMsg("");
    try {
      await attendanceApi.remove(id);
      setMsg("Attendance record deleted successfully.", "success");
      await load();
    } catch (error) {
      setMsg(error?.response?.data?.detail || "Failed to delete record.", "danger");
    } finally {
      setDeletingId(null);
    }
  };

  const createException = async (attendanceId, exceptionType) => {
    if (!isAdmin) return;
    setExceptionMessage("");
    try {
      const { data } = await attendanceExceptionApi.create({
        attendance_id: attendanceId,
        exception_type: exceptionType,
        reason: exceptionReason,
      });
      setExceptions((prev) => [data, ...prev].slice(0, 20));
      setMsg(`${exceptionType} exception created.`, "success");
    } catch (error) {
      setExceptionMessage(error?.response?.data?.detail || "Failed to create exception.");
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div>
        <h1 className="page-title">Attendance Logs</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
          {isStudent ? "Your attendance history" : "All attendance records with exception management"}
        </p>
      </div>

      {/* Main Card */}
      <div className="card">
        {/* Toolbar */}
        <div className="section-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {!isStudent && (
              <div style={{ position: "relative" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ position: "absolute", left: "0.625rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}>
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  id="attendance-search"
                  className="input input-sm"
                  style={{ paddingLeft: "2rem", width: 220 }}
                  placeholder="Search name or department…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {isAdmin && (
              <button onClick={exportCsv} className="btn btn-secondary btn-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`alert alert-${message.type} animate-fade-in`} style={{ marginBottom: "1rem" }}>
            {message.text}
          </div>
        )}

        {/* Count */}
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
          Showing <strong style={{ color: "var(--text-secondary)" }}>{records.length}</strong> of {totalRecords} records
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8, opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && records.length === 0 && (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 0.75rem", color: "var(--text-muted)", opacity: 0.4 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            No attendance records found
          </div>
        )}

        {/* Table */}
        {!loading && records.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Department</th>
                  <th>Timestamp</th>
                  <th>Confidence</th>
                  {isAdmin && <th>Exceptions</th>}
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: "50%",
                          background: "var(--primary-bg)",
                          border: "1px solid var(--border)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.7rem", fontWeight: 700, color: "var(--primary)",
                          flexShrink: 0,
                        }}>
                          {(row.person_name || "?")[0].toUpperCase()}
                        </div>
                        {row.person_name}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-slate">{row.department}</span>
                    </td>
                    <td style={{ fontFamily: "var(--mono, monospace)", fontSize: "0.8rem" }}>
                      {new Date(row.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <ConfidencePill value={row.confidence_score} />
                    </td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                          {EXCEPTION_TYPES.map((et) => (
                            <button
                              key={et.value}
                              type="button"
                              className={`badge ${et.cls}`}
                              style={{ cursor: "pointer", border: "none" }}
                              onClick={() => createException(row.id, et.value)}
                            >
                              {et.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    )}
                    {isAdmin && (
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteRecord(row.id)}
                          disabled={deletingId === row.id}
                        >
                          {deletingId === row.id ? "Deleting…" : "Delete"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="pagination" style={{ marginTop: "1rem", justifyContent: "space-between" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Page {page}</span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={loading || records.length < pageSize || page * pageSize >= totalRecords}
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Exceptions Panel */}
      {isAdmin && (
        <div className="card animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <div className="section-header">
            <div>
              <div className="section-title mb-1">Attendance Exceptions</div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Late, excused, absence, and manual adjustments
              </p>
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>
                Default reason
              </label>
              <input
                className="input input-sm"
                style={{ width: 240 }}
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
              />
            </div>
          </div>

          {exceptionMessage && (
            <div className="alert alert-danger animate-fade-in" style={{ marginBottom: "1rem" }}>
              {exceptionMessage}
            </div>
          )}

          {exceptionsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8 }} />
              ))}
            </div>
          ) : exceptions.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No exceptions recorded yet
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Attendance ID</th>
                    <th>Type</th>
                    <th>Reason</th>
                    <th>Created By</th>
                  </tr>
                </thead>
                <tbody>
                  {exceptions.map((ex) => {
                    const et = EXCEPTION_TYPES.find((e) => e.value === ex.exception_type);
                    return (
                      <tr key={ex.id}>
                        <td style={{ fontFamily: "var(--mono, monospace)", fontSize: "0.78rem" }}>
                          {new Date(ex.created_at).toLocaleString()}
                        </td>
                        <td style={{ fontFamily: "var(--mono, monospace)", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          {ex.attendance_id}
                        </td>
                        <td>
                          <span className={`badge ${et?.cls || "badge-slate"}`}>{ex.exception_type}</span>
                        </td>
                        <td>{ex.reason || "—"}</td>
                        <td style={{ color: "var(--text-muted)" }}>{ex.created_by_username}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
