import { useEffect, useMemo, useState } from "react";
import { undetectedFaceApi } from "../services/api";

export default function UndetectedFacesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "info" });
  const [reviewFilter, setReviewFilter] = useState("pending");
  const [previewUrls, setPreviewUrls] = useState({});

  const setMsg = (text, type = "info") => setMessage({ text, type });

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [items]
  );

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const params = { page: 1, page_size: 200 };
      if (reviewFilter === "pending") params.reviewed = false;
      else if (reviewFilter === "reviewed") params.reviewed = true;
      const { data } = await undetectedFaceApi.list(params);
      setItems(data?.items || data || []);
    } catch (error) {
      setMsg(error?.response?.data?.detail || "Failed to load undetected faces.", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [reviewFilter]);

  useEffect(() => {
    const ids = sortedItems.map((item) => item.id);
    const missingIds = ids.filter((id) => !previewUrls[id]);
    if (missingIds.length === 0) return;
    let canceled = false;
    const generatedUrls = [];
    const fetchMissing = async () => {
      for (const id of missingIds) {
        try {
          const response = await undetectedFaceApi.preview(id);
          if (canceled) return;
          const objectUrl = URL.createObjectURL(response.data);
          generatedUrls.push(objectUrl);
          setPreviewUrls((prev) => ({ ...prev, [id]: objectUrl }));
        } catch {
          if (canceled) return;
          setPreviewUrls((prev) => ({ ...prev, [id]: "" }));
        }
      }
    };
    fetchMissing();
    return () => { canceled = true; generatedUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [sortedItems, previewUrls]);

  useEffect(() => {
    return () => { Object.values(previewUrls).filter(Boolean).forEach((url) => URL.revokeObjectURL(url)); };
  }, [previewUrls]);

  const remove = async (id) => {
    setBusy(true);
    setMsg("");
    try {
      await undetectedFaceApi.remove(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setMsg("Undetected face removed.", "success");
    } catch (error) {
      setMsg(error?.response?.data?.detail || "Failed to delete.", "danger");
    } finally {
      setBusy(false);
    }
  };

  const toggleReviewed = async (id, reviewed) => {
    setBusy(true);
    setMsg("");
    try {
      const { data } = await undetectedFaceApi.updateReview(id, { reviewed });
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, reviewed: data.reviewed } : item)));
      setMsg(reviewed ? "Marked as reviewed." : "Marked as pending review.", "success");
    } catch (error) {
      setMsg(error?.response?.data?.detail || "Failed to update review state.", "danger");
    } finally {
      setBusy(false);
    }
  };

  const cleanup = async () => {
    setBusy(true);
    setMsg("");
    try {
      const { data } = await undetectedFaceApi.cleanup();
      setMsg(`Cleanup complete. Removed ${data?.deleted_records || 0} expired records.`, "success");
      await load();
    } catch (error) {
      setMsg(error?.response?.data?.detail || "Cleanup failed.", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="page-title">Undetected Faces</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Teacher / Admin review queue — records auto-expire after 7 days
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.625rem", alignItems: "center" }}>
          <select
            className="input input-sm"
            style={{ width: 160 }}
            value={reviewFilter}
            onChange={(e) => setReviewFilter(e.target.value)}
          >
            <option value="pending">Pending review</option>
            <option value="all">All</option>
            <option value="reviewed">Reviewed</option>
          </select>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={cleanup}
            disabled={busy}
          >
            {busy ? "Working…" : "Run Cleanup"}
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type} animate-fade-in`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 220, borderRadius: 14 }} />)}
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            style={{ margin: "0 auto 1rem", color: "var(--text-muted)", opacity: 0.4 }}>
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" y1="9" x2="9.01" y2="9"/>
            <line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No undetected faces in this view</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
          {sortedItems.map((item) => (
            <div key={item.id} className="card animate-fade-in" style={{ padding: 0, overflow: "hidden" }}>
              {/* Image */}
              <div style={{ position: "relative", aspectRatio: "16/10", background: "#000", flexShrink: 0 }}>
                {previewUrls[item.id] ? (
                  <img
                    src={previewUrls[item.id]}
                    alt="Undetected face"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : previewUrls[item.id] === "" ? (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.3)" }}>No preview</span>
                  </div>
                ) : (
                  <div className="skeleton" style={{ width: "100%", height: "100%", borderRadius: 0 }} />
                )}

                <div style={{
                  position: "absolute", top: "0.5rem", right: "0.5rem",
                }}>
                  <span className={`badge ${item.reviewed ? "badge-emerald" : "badge-amber"}`}>
                    {item.reviewed ? "Reviewed" : "Pending"}
                  </span>
                </div>
              </div>

              {/* Info + Actions */}
              <div style={{ padding: "0.875rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                  Source: <span style={{ color: "var(--text-secondary)" }}>{item.source_type}</span>
                </div>
                <div style={{ fontFamily: "var(--mono, monospace)", fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.875rem" }}>
                  {new Date(item.created_at).toLocaleString()}
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${item.reviewed ? "btn-secondary" : "btn-success"}`}
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => toggleReviewed(item.id, !item.reviewed)}
                    disabled={busy}
                  >
                    {item.reviewed ? "Reopen" : "Review"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => remove(item.id)}
                    disabled={busy}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
