import { useEffect, useState } from "react";
import { personApi, trainingApi } from "../services/api";

const STATUS_BADGE = {
  success: "badge-emerald",
  error: "badge-rose",
  pending: "badge-amber",
};

export default function TrainingPage() {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "info" });
  const [persons, setPersons] = useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [personImages, setPersonImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState(null);

  const setMsg = (text, type = "info") => setMessage({ text, type });

  const load = async () => {
    const [statusRes, logsRes, personsRes] = await Promise.all([
      trainingApi.status(),
      trainingApi.logs({ page: 1, page_size: 100 }),
      personApi.list({ page: 1, page_size: 200 }),
    ]);
    setStatus(statusRes.data);
    setLogs(logsRes.data?.items || logsRes.data || []);
    const allPersons = personsRes.data?.items || personsRes.data || [];
    setPersons(allPersons);
    if (!selectedPersonId && allPersons.length > 0) setSelectedPersonId(allPersons[0].id);
  };

  useEffect(() => { load(); }, []);

  const trigger = async () => {
    setLoading(true);
    setMsg("");
    try {
      await trainingApi.trigger();
      await load();
      setMsg("Training completed and logs refreshed.", "success");
    } catch (error) {
      setMsg(error?.response?.data?.detail || "Training failed.", "danger");
    } finally {
      setLoading(false);
    }
  };

  const loadPersonImages = async (personId) => {
    if (!personId) { setPersonImages([]); return; }
    setLoadingImages(true);
    try {
      const { data } = await personApi.listImages(personId);
      const images = data || [];
      const previews = await Promise.all(
        images.map(async (img) => {
          try {
            const response = await personApi.previewImage(img.id);
            return { ...img, previewUrl: URL.createObjectURL(response.data) };
          } catch {
            return { ...img, previewUrl: "" };
          }
        })
      );
      setPersonImages((prev) => {
        prev.forEach((img) => { if (img.previewUrl) URL.revokeObjectURL(img.previewUrl); });
        return previews;
      });
    } catch (error) {
      setMsg(error?.response?.data?.detail || "Failed to load images.", "danger");
      setPersonImages((prev) => { prev.forEach((img) => { if (img.previewUrl) URL.revokeObjectURL(img.previewUrl); }); return []; });
    } finally {
      setLoadingImages(false);
    }
  };

  const deletePersonImage = async (imageId) => {
    if (!imageId) return;
    setMsg("");
    setDeletingImageId(imageId);
    try {
      await personApi.deleteImage(imageId);
      setMsg("Image deleted successfully.", "success");
      await loadPersonImages(selectedPersonId);
    } catch (error) {
      setMsg(error?.response?.data?.detail || "Failed to delete image.", "danger");
    } finally {
      setDeletingImageId(null);
    }
  };

  useEffect(() => { loadPersonImages(selectedPersonId); }, [selectedPersonId]);

  useEffect(() => {
    return () => {
      personImages.forEach((img) => {
        if (img.previewUrl) {
          URL.revokeObjectURL(img.previewUrl);
        }
      });
    };
  }, [personImages]);


  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div>
        <h1 className="page-title">Model Training</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
          Trigger facial recognition model retraining and manage training images
        </p>
      </div>

      {/* Training Control */}
      <div className="card">
        <div className="section-title mb-3">Training Control</div>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "1.5rem" }}>
          <button
            id="trigger-training-btn"
            disabled={loading}
            onClick={trigger}
            className="btn btn-primary"
            style={{ minWidth: 160 }}
          >
            {loading ? (
              <>
                <div style={{ width: 14, height: 14, border: "2px solid rgba(13,17,23,0.3)", borderTopColor: "#0d1117", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                Training…
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
                </svg>
                Trigger Training
              </>
            )}
          </button>

          {status && (
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              <div>
                <div className="label">Status</div>
                <span className={`badge ${STATUS_BADGE[status.status] || "badge-slate"}`} style={{ marginTop: "0.25rem" }}>
                  {status.status}
                </span>
              </div>
              <div>
                <div className="label">Persons</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>{status.total_persons}</div>
              </div>
              <div>
                <div className="label">Images</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>{status.total_images}</div>
              </div>
            </div>
          )}
        </div>

        {message.text && (
          <div className={`alert alert-${message.type} animate-fade-in`} style={{ marginTop: "1rem" }}>
            {message.text}
          </div>
        )}
      </div>

      {/* Training Logs */}
      <div className="card">
        <div className="section-title mb-3">Training Logs</div>
        {logs.length === 0 ? (
          <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            No training logs yet
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: 300, overflowY: "auto" }}>
            {logs.map((log) => (
              <div key={log.id} style={{
                padding: "0.75rem 1rem",
                borderRadius: 10,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)",
                display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap",
              }}>
                <span className={`badge ${STATUS_BADGE[log.status] || "badge-slate"}`}>{log.status}</span>
                <span style={{ fontFamily: "var(--mono, monospace)", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {new Date(log.timestamp).toLocaleString()}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {log.total_persons} persons · {log.total_images} images
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image Viewer */}
      <div className="card">
        <div className="section-header">
          <div className="section-title">Person Image Viewer</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <select
              className="input input-sm"
              style={{ width: 220 }}
              value={selectedPersonId || ""}
              onChange={(e) => setSelectedPersonId(Number(e.target.value) || null)}
            >
              <option value="">Select person…</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.department})</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => loadPersonImages(selectedPersonId)}
              disabled={!selectedPersonId || loadingImages}
            >
              {loadingImages ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {loadingImages && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem" }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 10 }} />)}
          </div>
        )}

        {!loadingImages && selectedPersonId && personImages.length === 0 && (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            No images uploaded for this person
          </div>
        )}

        {!loadingImages && personImages.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem" }}>
            {personImages.map((img) => (
              <div key={img.id} style={{
                borderRadius: 12, overflow: "hidden",
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.03)",
              }}>
                {img.previewUrl ? (
                  <img
                    src={img.previewUrl}
                    alt={`Face ${img.id}`}
                    style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div style={{
                    width: "100%", height: 140,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(255,255,255,0.02)",
                    color: "var(--text-muted)", fontSize: "0.75rem",
                  }}>
                    No preview
                  </div>
                )}
                <div style={{ padding: "0.5rem 0.625rem" }}>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontFamily: "var(--mono, monospace)", marginBottom: "0.375rem" }}>
                    {new Date(img.uploaded_at).toLocaleDateString()}
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => deletePersonImage(img.id)}
                    disabled={deletingImageId === img.id}
                  >
                    {deletingImageId === img.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
