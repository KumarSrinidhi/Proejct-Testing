import { useEffect, useState } from "react";
import { attendanceApi } from "../services/api";

export default function AttendancePage() {
  const [records, setRecords] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editTimestamp, setEditTimestamp] = useState("");
  const [editConfidence, setEditConfidence] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    const { data } = await attendanceApi.list();
    setRecords(data);
  };

  useEffect(() => {
    load();
  }, []);

  const exportCsv = async () => {
    const { data } = await attendanceApi.exportCsv();
    const url = window.URL.createObjectURL(new Blob([data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = "attendance.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    const local = new Date(row.timestamp);
    const pad = (n) => String(n).padStart(2, "0");
    const dtLocal = `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
    setEditTimestamp(dtLocal);
    setEditConfidence(String(row.confidence_score));
    setMessage("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTimestamp("");
    setEditConfidence("");
  };

  const saveEdit = async (id) => {
    try {
      const confidence = Number(editConfidence);
      if (Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
        setMessage("Confidence must be between 0 and 1.");
        return;
      }
      await attendanceApi.update(id, {
        timestamp: new Date(editTimestamp).toISOString(),
        confidence_score: confidence,
      });
      setMessage("Attendance updated successfully.");
      cancelEdit();
      await load();
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to update attendance.");
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg">Attendance Logs</h3>
        <button onClick={exportCsv} className="rounded bg-accent text-white px-3 py-2">Export CSV</button>
      </div>
      {message ? <div className="mb-3 text-sm">{message}</div> : null}
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Name</th>
              <th className="p-2">Department</th>
              <th className="p-2">Timestamp</th>
              <th className="p-2">Confidence</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-2">{row.person_name}</td>
                <td className="p-2">{row.department}</td>
                <td className="p-2">
                  {editingId === row.id ? (
                    <input
                      type="datetime-local"
                      className="border rounded p-1"
                      value={editTimestamp}
                      onChange={(e) => setEditTimestamp(e.target.value)}
                    />
                  ) : (
                    new Date(row.timestamp).toLocaleString()
                  )}
                </td>
                <td className="p-2">
                  {editingId === row.id ? (
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.001"
                      className="border rounded p-1 w-24"
                      value={editConfidence}
                      onChange={(e) => setEditConfidence(e.target.value)}
                    />
                  ) : (
                    row.confidence_score.toFixed(3)
                  )}
                </td>
                <td className="p-2">
                  {editingId === row.id ? (
                    <div className="flex gap-2">
                      <button className="rounded bg-accent text-white px-2 py-1" onClick={() => saveEdit(row.id)}>Save</button>
                      <button className="rounded bg-slate-700 text-white px-2 py-1" onClick={cancelEdit}>Cancel</button>
                    </div>
                  ) : (
                    <button className="rounded bg-ink text-white px-2 py-1" onClick={() => startEdit(row)}>Edit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
