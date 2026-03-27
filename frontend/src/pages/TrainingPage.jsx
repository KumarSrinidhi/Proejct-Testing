import { useEffect, useState } from "react";
import { trainingApi } from "../services/api";

export default function TrainingPage() {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [editStatusValue, setEditStatusValue] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    const [statusRes, logsRes] = await Promise.all([trainingApi.status(), trainingApi.logs()]);
    setStatus(statusRes.data);
    setLogs(logsRes.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const trigger = async () => {
    setLoading(true);
    setMessage("");
    try {
      await trainingApi.trigger();
      await load();
      setMessage("Training completed and logs refreshed.");
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Training failed.");
    } finally {
      setLoading(false);
    }
  };

  const viewLog = async (logId) => {
    setMessage("");
    try {
      const { data } = await trainingApi.getLog(logId);
      setSelectedLog(data);
      setEditStatusValue(data.status || "");
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to load training log.");
    }
  };

  const saveLogStatus = async () => {
    if (!selectedLog) return;
    setMessage("");
    try {
      const { data } = await trainingApi.updateLog(selectedLog.id, { status: editStatusValue });
      setSelectedLog(data);
      await load();
      setMessage("Training log updated.");
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to update training log.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="font-display text-lg mb-3">Training Interface</h3>
        <button disabled={loading} onClick={trigger} className="rounded bg-accent text-white px-4 py-2">
          {loading ? "Training..." : "Trigger Training"}
        </button>
        {status && (
          <div className="mt-3 text-sm">
            Last status: {status.status} | Persons: {status.total_persons} | Images: {status.total_images}
          </div>
        )}
        {message ? <div className="mt-3 text-sm">{message}</div> : null}
      </div>

      <div className="card">
        <h4 className="font-display mb-2">Training Logs</h4>
        <div className="space-y-2 max-h-[300px] overflow-auto text-sm">
          {logs.map((log) => (
            <div key={log.id} className="rounded border p-2">
              <div>{new Date(log.timestamp).toLocaleString()}</div>
              <div>Status: {log.status}</div>
              <div>Persons: {log.total_persons} | Images: {log.total_images}</div>
              <button
                onClick={() => viewLog(log.id)}
                className="mt-2 rounded bg-ink text-white px-3 py-1"
              >
                View / Edit
              </button>
            </div>
          ))}
        </div>
      </div>

      {selectedLog ? (
        <div className="card">
          <h4 className="font-display mb-2">Selected Training Log</h4>
          <div className="text-sm space-y-1 mb-3">
            <div>ID: {selectedLog.id}</div>
            <div>Timestamp: {new Date(selectedLog.timestamp).toLocaleString()}</div>
            <div>Total Persons: {selectedLog.total_persons}</div>
            <div>Total Images: {selectedLog.total_images}</div>
          </div>
          <label className="text-sm flex flex-col gap-2">
            Edit Status
            <input
              value={editStatusValue}
              onChange={(e) => setEditStatusValue(e.target.value)}
              className="border rounded p-2"
            />
          </label>
          <button onClick={saveLogStatus} className="mt-3 rounded bg-accent text-white px-4 py-2">
            Save Changes
          </button>
        </div>
      ) : null}
    </div>
  );
}
