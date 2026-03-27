import { useEffect, useState } from "react";
import { trainingApi } from "../services/api";

export default function TrainingPage() {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

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
    try {
      await trainingApi.trigger();
      await load();
    } finally {
      setLoading(false);
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
      </div>

      <div className="card">
        <h4 className="font-display mb-2">Training Logs</h4>
        <div className="space-y-2 max-h-[300px] overflow-auto text-sm">
          {logs.map((log) => (
            <div key={log.id} className="rounded border p-2">
              <div>{new Date(log.timestamp).toLocaleString()}</div>
              <div>Status: {log.status}</div>
              <div>Persons: {log.total_persons} | Images: {log.total_images}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
