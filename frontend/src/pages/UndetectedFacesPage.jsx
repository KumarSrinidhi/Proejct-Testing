import { useEffect, useMemo, useState } from "react";

import { undetectedFaceApi } from "../services/api";

export default function UndetectedFacesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [previewUrls, setPreviewUrls] = useState({});

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [items]
  );

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const { data } = await undetectedFaceApi.list();
      setItems(data || []);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to load undetected faces.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const ids = sortedItems.map((item) => item.id);
    const missingIds = ids.filter((id) => !previewUrls[id]);
    if (missingIds.length === 0) {
      return;
    }

    let canceled = false;
    const generatedUrls = [];

    const fetchMissing = async () => {
      for (const id of missingIds) {
        try {
          const response = await undetectedFaceApi.preview(id);
          if (canceled) {
            return;
          }
          const objectUrl = URL.createObjectURL(response.data);
          generatedUrls.push(objectUrl);
          setPreviewUrls((prev) => ({ ...prev, [id]: objectUrl }));
        } catch (_error) {
          if (canceled) {
            return;
          }
          setPreviewUrls((prev) => ({ ...prev, [id]: "" }));
        }
      }
    };

    fetchMissing();

    return () => {
      canceled = true;
      generatedUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [sortedItems, previewUrls]);

  useEffect(() => {
    return () => {
      Object.values(previewUrls)
        .filter(Boolean)
        .forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const remove = async (id) => {
    setBusy(true);
    setMessage("");
    try {
      await undetectedFaceApi.remove(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setMessage("Undetected face removed.");
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to delete undetected face.");
    } finally {
      setBusy(false);
    }
  };

  const cleanup = async () => {
    setBusy(true);
    setMessage("");
    try {
      const { data } = await undetectedFaceApi.cleanup();
      setMessage(`Cleanup complete. Removed ${data?.deleted_records || 0} expired records.`);
      await load();
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to run cleanup.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="card">Loading undetected faces...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Undetected Faces</h2>
          <p className="text-sm text-slate-600">Teacher/Admin review queue. Records auto-retain for 7 days.</p>
        </div>
        <button
          type="button"
          className="rounded bg-ink text-white px-3 py-2"
          onClick={cleanup}
          disabled={busy}
        >
          {busy ? "Working..." : "Run Cleanup"}
        </button>
      </div>

      {message ? <div className="card text-sm">{message}</div> : null}

      {sortedItems.length === 0 ? (
        <div className="card">No undetected faces found.</div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedItems.map((item) => (
            <div key={item.id} className="card space-y-2">
              <div className="aspect-video overflow-hidden rounded bg-slate-100 flex items-center justify-center">
                {previewUrls[item.id] ? (
                  <img src={previewUrls[item.id]} alt="Undetected face" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm text-slate-500">Preview unavailable</span>
                )}
              </div>
              <div className="text-sm text-slate-700">Source: {item.source_type}</div>
              <div className="text-sm text-slate-700">Captured: {new Date(item.created_at).toLocaleString()}</div>
              <button
                type="button"
                className="rounded bg-red-600 text-white px-3 py-2 w-fit"
                onClick={() => remove(item.id)}
                disabled={busy}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
