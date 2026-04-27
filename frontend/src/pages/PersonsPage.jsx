import { useEffect, useRef, useState } from "react";
import { personApi } from "../services/api";

const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export default function PersonsPage() {
  const [persons, setPersons] = useState([]);
  const [totalPersons, setTotalPersons] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "info" });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Create form
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", department: "", email: "" });

  // Image upload
  const [uploadPersonId, setUploadPersonId] = useState("");
  const [uploadFiles, setUploadFiles] = useState([]);
  const fileInputRef = useRef(null);

  const setMsg = (text, type = "info") => setMessage({ text, type });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await personApi.list({ page, page_size: pageSize, search: debouncedSearch });
      const items = data?.items || data || [];
      setPersons(items);
      setTotalPersons(data?.total ?? items.length);
    } catch (error) {
      setMsg(error?.response?.data?.detail || error?.message || "Failed to load persons.", "danger");
      setPersons([]);
      setTotalPersons(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, debouncedSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const createPerson = async (event) => {
    event.preventDefault();
    if (form.email && !isValidEmail(form.email)) {
      setMsg("Invalid email format.", "danger");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await personApi.create(form);
      setForm({ name: "", department: "", email: "" });
      setMsg("Person created successfully.", "success");
      setFormOpen(false);
      await load();
    } catch (error) {
      setMsg(error?.response?.data?.detail || error?.message || "Failed to create person.", "danger");
    } finally {
      setBusy(false);
    }
  };

  const deletePerson = async (id) => {
    if (!window.confirm("Delete this person? All linked data will also be removed.")) return;
    setBusy(true);
    setMsg("");
    try {
      await personApi.remove(id);
      setMsg("Person deleted.", "success");
      await load();
    } catch (error) {
      setMsg(error?.response?.data?.detail || error?.message || "Failed to delete person.", "danger");
    } finally {
      setBusy(false);
    }
  };

  const uploadImages = async (event) => {
    event.preventDefault();
    if (!uploadPersonId) { setMsg("Select a person before uploading.", "warning"); return; }
    if (uploadFiles.length === 0) { setMsg("Select at least one image.", "warning"); return; }
    setBusy(true);
    setMsg("");

    // Client-side size check (15 MB limit)
    const MAX_BYTES = 15 * 1024 * 1024;
    const oversized = uploadFiles.filter(f => f.size > MAX_BYTES);
    if (oversized.length > 0) {
      setMsg(`${oversized.map(f => f.name).join(", ")} exceed 15 MB. Please reduce the file size.`, "danger");
      setBusy(false);
      return;
    }

    try {
      const fd = new FormData();
      for (const file of uploadFiles) fd.append("files", file);
      const resp = await personApi.uploadImages(Number(uploadPersonId), fd);
      const results = resp?.data?.results ?? [];
      const failed  = results.filter(r => r.status === "failed");
      const ok      = results.filter(r => r.status === "ok");

      if (failed.length > 0) {
        const reasons = failed.map(r => `${r.filename}: ${r.reason}`).join(" · ");
        setMsg(
          `${ok.length} uploaded, ${failed.length} failed — ${reasons}`,
          failed.length === results.length ? "danger" : "warning"
        );
      } else {
        setMsg(`${ok.length} image${ok.length > 1 ? "s" : ""} uploaded. Retrain the model to apply changes.`, "success");
      }
    } catch (error) {
      setMsg(error?.response?.data?.detail || error?.message || "Upload failed — check file format (JPG/PNG) and size.", "danger");
    }

    setUploadFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setBusy(false);
  };


  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="page-title">Person Registry</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Manage registered persons and their training images
          </p>
        </div>
        <button
          id="open-create-person-btn"
          className="btn btn-primary"
          onClick={() => setFormOpen((v) => !v)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {formOpen ? "Cancel" : "Add Person"}
        </button>
      </div>

      {/* Create Form */}
      {formOpen && (
        <div className="card animate-fade-in">
          <div className="section-title mb-4">New Person</div>
          <form onSubmit={createPerson} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.3rem", fontWeight: 500 }}>
                  Full Name *
                </label>
                <input
                  className="input"
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={busy}
                  required
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.3rem", fontWeight: 500 }}>
                  Department *
                </label>
                <input
                  className="input"
                  placeholder="Department"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  disabled={busy}
                  required
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.3rem", fontWeight: 500 }}>
                  Email
                </label>
                <input
                  className="input"
                  type="email"
                  placeholder="user@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={busy}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Create Person"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Alert */}
      {message.text && (
        <div className={`alert alert-${message.type} animate-fade-in`}>{message.text}</div>
      )}

      {/* Image Upload Panel */}
      <div className="card">
        <div className="section-title mb-3">Upload Training Images</div>
        <form onSubmit={uploadImages} style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
          <div style={{ minWidth: 200, flex: 1 }}>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.3rem", fontWeight: 500 }}>
              Person
            </label>
            <select
              className="input"
              value={uploadPersonId}
              onChange={(e) => setUploadPersonId(e.target.value)}
              disabled={busy}
            >
              <option value="">Select person…</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.department}</option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 200, flex: 2 }}>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.3rem", fontWeight: 500 }}>
              Images (JPG / PNG)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="input"
              onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
              disabled={busy}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy || !uploadPersonId || uploadFiles.length === 0}>
            {busy ? "Uploading…" : `Upload${uploadFiles.length > 0 ? ` (${uploadFiles.length})` : ""}`}
          </button>
        </form>
        {uploadFiles.length > 0 && (
          <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
            {uploadFiles.map((f, i) => (
              <span key={i} className="badge badge-slate">{f.name}</span>
            ))}
          </div>
        )}
      </div>

      {/* Persons Table */}
      <div className="card">
        <div className="section-header">
          <div className="section-title">Registered Persons</div>
          <div style={{ display: "flex", gap: "0.625rem", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ position: "absolute", left: "0.625rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                id="person-search"
                className="input input-sm"
                style={{ paddingLeft: "2rem", width: 220 }}
                placeholder="Search persons…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                disabled={busy}
              />
            </div>
          </div>
        </div>

        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
          Showing <strong style={{ color: "var(--text-secondary)" }}>{persons.length}</strong> of {totalPersons} persons
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />)}
          </div>
        ) : persons.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ margin: "0 auto 0.75rem", opacity: 0.3 }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            No persons found
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Email</th>
                  <th>ID</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {persons.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: "var(--primary-bg)",
                          border: "1px solid var(--border)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.8rem", fontWeight: 700, color: "var(--primary)",
                          flexShrink: 0,
                        }}>
                          {(person.name || "?")[0].toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{person.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-slate">{person.department}</span>
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{person.email || "—"}</td>
                    <td style={{ fontFamily: "var(--mono, monospace)", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      #{person.id}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => deletePerson(person.id)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </td>
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
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>← Prev</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPage((p) => p + 1)} disabled={loading || persons.length < pageSize || page * pageSize >= totalPersons}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
