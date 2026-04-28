import { useEffect, useState } from "react";
import { userApi } from "../services/api";
import { formatDateIst } from "../utils/datetime";

const ROLE_OPTIONS = ["admin", "teacher", "student"];
const ROLE_BADGE = {
  admin: "badge-violet",
  teacher: "badge-cyan",
  student: "badge-emerald",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;
  const [form, setForm] = useState({
    username: "", email: "", password: "", role: "student",
    create_person_profile: true, person_name: "", person_department: "",
  });
  const [resetPasswordByUserId, setResetPasswordByUserId] = useState({});
  const [message, setMessage] = useState({ text: "", type: "info" });
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const setMsg = (text, type = "info") => setMessage({ text, type });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await userApi.list({ page, page_size: pageSize, search });
      const items = data?.items || data || [];
      setUsers(items);
      setTotalUsers(data?.total ?? items.length);
    } catch (error) {
      setMsg(error?.response?.data?.detail || "Failed to load users.", "danger");
      setUsers([]);
      setTotalUsers(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, [page, search]);

  const createUser = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await userApi.create(form);
      setForm({ username: "", email: "", password: "", role: "student", create_person_profile: true, person_name: "", person_department: "" });
      setMsg("User created successfully.", "success");
      setFormOpen(false);
      await loadUsers();
    } catch (error) {
      setMsg(error?.response?.data?.detail || "Failed to create user.", "danger");
    } finally {
      setBusy(false);
    }
  };

  const updateRole = async (id, role) => {
    setBusy(true);
    setMsg("");
    try {
      await userApi.updateRole(id, role);
      setMsg("Role updated.", "success");
      await loadUsers();
    } catch (error) {
      setMsg(error?.response?.data?.detail || "Failed to update role.", "danger");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (id) => {
    const password = (resetPasswordByUserId[id] || "").trim();
    if (!password) { setMsg("Enter a password before resetting.", "warning"); return; }
    setBusy(true);
    setMsg("");
    try {
      await userApi.updatePassword(id, password);
      setResetPasswordByUserId((prev) => ({ ...prev, [id]: "" }));
      setMsg("Password updated.", "success");
    } catch (error) {
      setMsg(error?.response?.data?.detail || "Failed to update password.", "danger");
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (id) => {
    if (!window.confirm("Delete this user? This action cannot be undone.")) return;
    setBusy(true);
    setMsg("");
    try {
      await userApi.remove(id);
      setMsg("User deleted.", "success");
      await loadUsers();
    } catch (error) {
      setMsg(error?.response?.data?.detail || "Failed to delete user.", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="page-title">User Management</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Create and manage system users and their access roles
          </p>
        </div>
        <button
          id="open-create-user-form"
          className="btn btn-primary"
          onClick={() => setFormOpen((v) => !v)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {formOpen ? "Cancel" : "Create User"}
        </button>
      </div>

      {/* Create Form */}
      {formOpen && (
        <div className="card animate-fade-in">
          <div className="section-title mb-4">Create New User</div>
          <form onSubmit={createUser} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.3rem", fontWeight: 500 }}>Username *</label>
                <input className="input" placeholder="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={busy} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.3rem", fontWeight: 500 }}>Email</label>
                <input className="input" type="email" placeholder="user@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={busy} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.3rem", fontWeight: 500 }}>Password *</label>
                <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} disabled={busy} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.3rem", fontWeight: 500 }}>Role</label>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} disabled={busy}>
                  {ROLE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)", cursor: "pointer" }}>
              <input
                type="checkbox"
                className="checkbox"
                checked={form.create_person_profile}
                onChange={(e) => setForm({ ...form, create_person_profile: e.target.checked })}
                disabled={busy}
              />
              Also create / update a linked person profile
            </label>

            {form.create_person_profile && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.3rem", fontWeight: 500 }}>Person Name</label>
                  <input className="input" placeholder="Full name" value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.target.value })} disabled={busy} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.3rem", fontWeight: 500 }}>Department</label>
                  <input className="input" placeholder="Department" value={form.person_department} onChange={(e) => setForm({ ...form, person_department: e.target.value })} disabled={busy} />
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Creating…" : "Create User"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Message */}
      {message.text && (
        <div className={`alert alert-${message.type} animate-fade-in`}>
          {message.text}
        </div>
      )}

      {/* Users Table */}
      <div className="card">
        <div className="section-header">
          <div className="section-title">Users</div>
          <div style={{ display: "flex", gap: "0.625rem", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ position: "absolute", left: "0.625rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                id="user-search"
                className="input input-sm"
                style={{ paddingLeft: "2rem", width: 220 }}
                placeholder="Search users…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={loadUsers} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
          Showing <strong style={{ color: "var(--text-secondary)" }}>{users.length}</strong> of {totalUsers} users
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />)}
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>No users found</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Linked Person</th>
                  <th>Created</th>
                  <th>Reset Password</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: "var(--primary-bg)",
                          border: "1px solid var(--border)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.8rem", fontWeight: 700, color: "var(--primary)",
                          flexShrink: 0,
                        }}>
                          {(user.username || "?")[0].toUpperCase()}
                        </div>
                        {user.username}
                      </div>
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{user.email || "—"}</td>
                    <td>
                      <select
                        className="input input-sm"
                        style={{ width: "auto", minWidth: 100 }}
                        value={user.role}
                        onChange={(e) => updateRole(user.id, e.target.value)}
                        disabled={busy}
                      >
                        {ROLE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                    <td>
                      {user.person_name
                        ? <span>{user.person_name} <span className="badge badge-slate" style={{ marginLeft: 4 }}>{user.person_department || "N/A"}</span></span>
                        : <span style={{ color: "var(--text-muted)" }}>Not linked</span>
                      }
                    </td>
                    <td style={{ fontFamily: "var(--mono, monospace)", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {formatDateIst(user.created_at)}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <input
                          className="input input-sm"
                          type="password"
                          placeholder="New password"
                          style={{ width: 140 }}
                          value={resetPasswordByUserId[user.id] || ""}
                          onChange={(e) => setResetPasswordByUserId((prev) => ({ ...prev, [user.id]: e.target.value }))}
                          disabled={busy}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => resetPassword(user.id)}
                          disabled={busy}
                        >
                          Save
                        </button>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => removeUser(user.id)}
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
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPage((p) => p + 1)} disabled={loading || users.length < pageSize || page * pageSize >= totalUsers}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
