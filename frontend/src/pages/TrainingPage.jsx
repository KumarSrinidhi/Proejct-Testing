import { useEffect, useState } from "react";
import { personApi, trainingApi } from "../services/api";

export default function TrainingPage() {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [editStatusValue, setEditStatusValue] = useState("");
  const [message, setMessage] = useState("");
  const [persons, setPersons] = useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [personImages, setPersonImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);

  const load = async () => {
    const [statusRes, logsRes, personsRes] = await Promise.all([trainingApi.status(), trainingApi.logs(), personApi.list()]);
    setStatus(statusRes.data);
    setLogs(logsRes.data || []);
    const allPersons = personsRes.data || [];
    setPersons(allPersons);
    if (!selectedPersonId && allPersons.length > 0) {
      setSelectedPersonId(allPersons[0].id);
    }
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

  const loadPersonImages = async (personId) => {
    if (!personId) {
      setPersonImages([]);
      return;
    }
    setLoadingImages(true);
    try {
      const { data } = await personApi.listImages(personId);
      const images = data || [];
      const previews = await Promise.all(
        images.map(async (img) => {
          try {
            const response = await personApi.previewImage(img.id);
            return {
              ...img,
              previewUrl: URL.createObjectURL(response.data),
            };
          } catch {
            return {
              ...img,
              previewUrl: "",
            };
          }
        })
      );
      setPersonImages((prev) => {
        prev.forEach((img) => {
          if (img.previewUrl) {
            URL.revokeObjectURL(img.previewUrl);
          }
        });
        return previews;
      });
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to load person images.");
      setPersonImages((prev) => {
        prev.forEach((img) => {
          if (img.previewUrl) {
            URL.revokeObjectURL(img.previewUrl);
          }
        });
        return [];
      });
    } finally {
      setLoadingImages(false);
    }
  };

  useEffect(() => {
    loadPersonImages(selectedPersonId);
  }, [selectedPersonId]);

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

      <div className="card">
        <h4 className="font-display mb-2">Person Image Viewer</h4>
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <label className="text-sm flex flex-col gap-1 min-w-[240px]">
            Person
            <select
              value={selectedPersonId || ""}
              onChange={(e) => setSelectedPersonId(Number(e.target.value) || null)}
              className="border rounded p-2"
            >
              <option value="">Select person</option>
              {persons.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} ({person.department})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="rounded bg-ink text-white px-3 py-2"
            onClick={() => loadPersonImages(selectedPersonId)}
            disabled={!selectedPersonId || loadingImages}
          >
            {loadingImages ? "Loading..." : "Refresh Images"}
          </button>
        </div>

        {loadingImages ? <div className="text-sm">Loading images...</div> : null}
        {!loadingImages && selectedPersonId && personImages.length === 0 ? (
          <div className="text-sm">No images uploaded for this person.</div>
        ) : null}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {personImages.map((img) => (
            <div key={img.id} className="rounded-lg border p-2 bg-white">
              {img.previewUrl ? (
                <img src={img.previewUrl} alt={`Person ${selectedPersonId} ${img.id}`} className="w-full h-32 object-cover rounded" />
              ) : (
                <div className="w-full h-32 rounded bg-slate-200 flex items-center justify-center text-xs text-slate-600">
                  Preview unavailable
                </div>
              )}
              <div className="text-xs mt-2">Image ID: {img.id}</div>
              <div className="text-xs text-slate-600">{new Date(img.uploaded_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
