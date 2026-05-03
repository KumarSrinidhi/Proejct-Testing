import { useEffect, useMemo, useRef, useState } from "react";
import { attendanceApi, personApi, undetectedFaceApi } from "../services/api";
import { formatDateTimeIst } from "../utils/datetime";

// How many days until an undetected-face record expires on the backend.
const RETENTION_DAYS = 7;

/** Returns days remaining until auto-deletion (negative = already expired). */
function daysUntilExpiry(createdAt) {
  const parsed = createdAt instanceof Date ? createdAt : new Date(
    typeof createdAt === "string" && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(createdAt)
      ? `${createdAt}Z`
      : createdAt
  );
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  const expireMs = parsed.getTime() + RETENTION_DAYS * 86400000;
  return Math.ceil((expireMs - Date.now()) / 86400000);
}

/**
 * Displays a colour-coded "Expires in Xd" pill badge.
 * Defined at module scope (not inside the component) so React never sees it
 * as a new component type between renders.
 */
function ExpiryBadge({ createdAt }) {
  const days = daysUntilExpiry(createdAt);
  if (days === null) return null;

  // Colour + background pair so the badge is legible in both light and dark mode.
  const [color, bg] =
    days <= 1
      ? ["#ef4444", "rgba(239,68,68,0.12)"]
      : days <= 3
      ? ["#d97706", "rgba(217,119,6,0.12)"]
      : ["#64748b", "rgba(100,116,139,0.10)"];   // slate — visible on white AND dark cards

  const label = days <= 0 ? "⚠ Expiring now" : `⏱ Expires in ${days}d`;

  return (
    <span style={{
      display: "inline-block",
      fontSize: "0.67rem",
      fontWeight: 700,
      letterSpacing: "0.03em",
      color,
      background: bg,
      borderRadius: "999px",
      padding: "1px 7px",
      lineHeight: "1.6",
    }}>
      {label}
    </span>
  );
}

/**
 * Modal that lets a teacher/admin pick a registered person and log
 * attendance for an undetected face at its capture timestamp.
 * Defined at module scope so React never remounts it between renders.
 */
function MarkAttendanceModal({ face, onClose, onSuccess }) {
  const [persons, setPersons]     = useState([]);
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  // Fetch persons once when the modal opens.
  useEffect(() => {
    personApi.list({ page_size: 200 })
      .then(({ data }) => setPersons(data.items ?? data))
      .catch(() => setError("Failed to load persons list."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = persons.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.department ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      // Ensure the timestamp is UTC-aware so Pydantic parses it correctly.
      // The backend returns naive datetime strings (no timezone suffix);
      // appending 'Z' tells Pydantic to treat it as UTC.
      const rawTs = face.created_at;
      const ts = rawTs && typeof rawTs === "string" && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(rawTs)
        ? `${rawTs}Z`
        : (rawTs ?? null);

      await attendanceApi.createManual({
        person_id: selected.id,
        timestamp: ts,
        undetected_face_id: face.id,
      });
      onSuccess(selected);
    } catch (err) {
      const d = err?.response?.data?.detail;
      // detail can be a string OR an array of Pydantic validation error objects
      const msg = Array.isArray(d)
        ? d.map((e) => `${e.loc?.slice(-1)[0] ?? "field"}: ${e.msg}`).join(" | ")
        : (typeof d === "string" ? d : null);
      setError(msg || `Error ${err?.response?.status ?? ""}: Failed to log attendance.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {/* Modal panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card, #fff)",
          borderRadius: "12px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          width: "min(420px, 92vw)",
          display: "flex", flexDirection: "column", gap: "1rem",
          padding: "1.5rem",
          maxHeight: "80vh",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Mark Attendance</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", lineHeight: 1 }}>✕</button>
        </div>

        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
          Captured: <strong>{formatDateTimeIst(face.created_at)}</strong>
        </p>

        <input
          autoFocus
          placeholder="Search by name or department…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "8px",
            border: "1px solid var(--border-color, #e2e8f0)",
            fontSize: "0.85rem",
            outline: "none",
            width: "100%",
            boxSizing: "border-box",
          }}
        />

        {loading ? (
          <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>Loading persons…</p>
        ) : (
          <div style={{ overflowY: "auto", maxHeight: "260px", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {filtered.length === 0 && (
              <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>No persons found.</p>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "8px",
                  border: selected?.id === p.id
                    ? "2px solid var(--color-primary, #6366f1)"
                    : "1px solid var(--border-color, #e2e8f0)",
                  background: selected?.id === p.id ? "rgba(99,102,241,0.08)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border 0.15s, background 0.15s",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{p.name}</span>
                {p.department && (
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{p.department}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {error && <p style={{ color: "#ef4444", fontSize: "0.78rem", margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSubmit}
            disabled={!selected || saving}
          >
            {saving ? "Logging…" : `✓ Log for ${selected?.name ?? "…"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UndetectedFacesPage() {
  const [items, setItems]               = useState([]);
  const [loading, setLoading]           = useState(true);
  // Bug 3 fix — per-item busy set instead of a single shared flag
  const [busyIds, setBusyIds]           = useState(() => new Set());
  const [cleanupBusy, setCleanupBusy]   = useState(false);
  const [message, setMessage]           = useState({ text: "", type: "info" });
  const [reviewFilter, setReviewFilter] = useState("pending");
  const [previewUrls, setPreviewUrls]   = useState({});
  // Modal state — which face card has the Mark Attendance modal open (null = closed)
  const [modalFace, setModalFace]       = useState(null);

  // Bug 1 fix — track already-fetched IDs in a ref so the effect
  // doesn't need previewUrls in its dependency array.
  const fetchedIdsRef = useRef(new Set());

  const setMsg = (text, type = "info") => setMessage({ text, type });

  const setItemBusy = (id, val) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      val ? next.add(id) : next.delete(id);
      return next;
    });

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [items]
  );

  const load = async () => {
    setLoading(true);
    setMsg("");

    // Bug 2 fix — revoke all stale blob URLs and clear the cache whenever
    // we load a new filter so we don't leak memory or show stale images.
    setPreviewUrls((prev) => {
      Object.values(prev).filter(Boolean).forEach((url) => URL.revokeObjectURL(url));
      return {};
    });
    fetchedIdsRef.current.clear();

    try {
      const params = { page: 1, page_size: 200 };
      if (reviewFilter === "pending")  params.reviewed = false;
      else if (reviewFilter === "reviewed") params.reviewed = true;
      const { data } = await undetectedFaceApi.list(params);
      setItems(data?.items || data || []);
    } catch (error) {
      setMsg(error?.response?.data?.detail || "Failed to load undetected faces.", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [reviewFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bug 1 fix — this effect only depends on sortedItems (not previewUrls).
  // We use fetchedIdsRef to skip IDs already in flight or done without
  // adding previewUrls to the dep array (which would cause an infinite loop).
  useEffect(() => {
    const missingIds = sortedItems
      .map((item) => item.id)
      .filter((id) => !fetchedIdsRef.current.has(id));

    if (missingIds.length === 0) return;

    // Mark them immediately so a second effect run doesn't double-fetch.
    missingIds.forEach((id) => fetchedIdsRef.current.add(id));

    let canceled = false;
    // Track only the URLs created in THIS effect invocation so we can revoke
    // them precisely if the effect is cleaned up before images are consumed.
    const localUrls = {};

    const fetchMissing = async () => {
      for (const id of missingIds) {
        try {
          const response = await undetectedFaceApi.preview(id);
          if (canceled) { URL.revokeObjectURL(URL.createObjectURL(response.data)); return; }
          const url = URL.createObjectURL(response.data);
          localUrls[id] = url;
          setPreviewUrls((prev) => ({ ...prev, [id]: url }));
        } catch {
          if (canceled) return;
          setPreviewUrls((prev) => ({ ...prev, [id]: "" }));
        }
      }
    };

    fetchMissing();

    return () => {
      canceled = true;
      // Only revoke URLs we created in this specific effect run.
      Object.values(localUrls).forEach((url) => URL.revokeObjectURL(url));
      Object.keys(localUrls).forEach((id) => {
        fetchedIdsRef.current.delete(Number(id));
      });
    };
  }, [sortedItems]); // ← NOT depending on previewUrls

  // Revoke ALL remaining blob URLs on full component unmount only.
  useEffect(() => {
    return () => {
      setPreviewUrls((prev) => {
        Object.values(prev).filter(Boolean).forEach((url) => URL.revokeObjectURL(url));
        return {};
      });
    };
  }, []);

  // Per-item busy slot; 404 → card already gone, drop it silently.
  const remove = async (id) => {
    setItemBusy(id, true);
    setMsg("");
    try {
      await undetectedFaceApi.remove(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setMsg("Undetected face removed.", "success");
    } catch (error) {
      if (error?.response?.status === 404) {
        // Record was already deleted (cleanup / another user). Drop it from view.
        setItems((prev) => prev.filter((item) => item.id !== id));
        setMsg("Record no longer exists — removed from view.", "info");
      } else {
        setMsg(error?.response?.data?.detail || "Failed to delete.", "danger");
      }
    } finally {
      setItemBusy(id, false);
    }
  };

  const toggleReviewed = async (id, reviewed) => {
    setItemBusy(id, true);
    setMsg("");
    try {
      const { data } = await undetectedFaceApi.updateReview(id, { reviewed });
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, reviewed: data.reviewed } : item))
      );
      setMsg(reviewed ? "Marked as reviewed." : "Marked as pending review.", "success");
    } catch (error) {
      if (error?.response?.status === 404) {
        // Record was already deleted (cleanup ran, or another reviewer acted first).
        setItems((prev) => prev.filter((item) => item.id !== id));
        setMsg("Record no longer exists — removed from view.", "info");
      } else {
        setMsg(error?.response?.data?.detail || "Failed to update review state.", "danger");
      }
    } finally {
      setItemBusy(id, false);
    }
  };

  // Bug 4 fix — cleanup gets its own busy flag and uses ?? instead of ||
  const cleanup = async () => {
    setCleanupBusy(true);
    setMsg("");
    try {
      const { data } = await undetectedFaceApi.cleanup();
      // Bug 4 fix — use nullish coalescing so a real 0 isn't hidden
      setMsg(`Cleanup complete. Removed ${data?.deleted_records ?? 0} expired records.`, "success");
      await load();
    } catch (error) {
      setMsg(error?.response?.data?.detail || "Cleanup failed.", "danger");
    } finally {
      setCleanupBusy(false);
    }
  };

  // Mark Attendance handler — called when the modal successfully logs attendance.
  const handleMarkAttendance = (face, person) => {
    setModalFace(null);
    setMsg(`✓ Attendance logged for ${person.name} at ${formatDateTimeIst(face.created_at)}.`, "success");
    // Auto-mark the face as reviewed since the person has been identified.
    toggleReviewed(face.id, true);
  };

  // ExpiryBadge is defined at module scope above — no inline definition needed.

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="page-title">Undetected Faces</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Teacher / Admin review queue — records auto-expire after {RETENTION_DAYS} days
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
            disabled={cleanupBusy}
          >
            {cleanupBusy ? "Working…" : "Run Cleanup"}
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

                <div style={{ position: "absolute", top: "0.5rem", right: "0.5rem" }}>
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
                <div style={{ fontFamily: "var(--mono, monospace)", fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                  {formatDateTimeIst(item.created_at)}
                </div>
                {/* Bug 5 fix — expiry countdown */}
                <div style={{ marginBottom: "0.75rem" }}>
                  <ExpiryBadge createdAt={item.created_at} />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${item.reviewed ? "btn-secondary" : "btn-success"}`}
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => toggleReviewed(item.id, !item.reviewed)}
                    disabled={busyIds.has(item.id)}
                  >
                    {busyIds.has(item.id) ? "…" : item.reviewed ? "Reopen" : "Review"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => remove(item.id)}
                    disabled={busyIds.has(item.id)}
                  >
                    {busyIds.has(item.id) ? "…" : "Delete"}
                  </button>
                </div>
                {/* Mark Attendance — identify the person and log their entry */}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ width: "100%", justifyContent: "center", marginTop: "0.4rem" }}
                  onClick={() => setModalFace(item)}
                  disabled={busyIds.has(item.id)}
                >
                  👤 Mark Attendance
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mark Attendance modal — rendered outside the card grid so it sits above everything */}
      {modalFace && (
        <MarkAttendanceModal
          face={modalFace}
          onClose={() => setModalFace(null)}
          onSuccess={(person) => handleMarkAttendance(modalFace, person)}
        />
      )}
    </div>
  );
}
