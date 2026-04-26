import { useEffect, useState } from "react";
import { userApi } from "../services/api";

const ROLE_OPTIONS = ["admin", "teacher", "student"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "student",
    create_person_profile: true,
    person_name: "",
    person_department: "",
  });
  const [resetPasswordByUserId, setResetPasswordByUserId] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await userApi.list({ page, page_size: pageSize, search });
      const items = data?.items || data || [];
      setUsers(items);
      setTotalUsers(data?.total ?? items.length);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to load users.");
      setUsers([]);
      setTotalUsers(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers().catch((error) => {
      setMessage(error?.response?.data?.detail || "Failed to load users.");
    });
  }, [page, search]);

  const createUser = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await userApi.create(form);
      setForm({
        username: "",
        email: "",
        password: "",
        role: "student",
        create_person_profile: true,
        person_name: "",
        person_department: "",
      });
      setMessage("User created.");
      await loadUsers();
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to create user.");
    } finally {
      setBusy(false);
    }
  };

  const updateRole = async (id, role) => {
    setBusy(true);
    setMessage("");
    try {
      await userApi.updateRole(id, role);
      setMessage("Role updated.");
      await loadUsers();
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to update role.");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (id) => {
    const password = (resetPasswordByUserId[id] || "").trim();
    if (!password) {
      setMessage("Enter a password before reset.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      await userApi.updatePassword(id, password);
      setResetPasswordByUserId((prev) => ({ ...prev, [id]: "" }));
      setMessage("Password updated.");
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to update password.");
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (id) => {
    const confirmed = window.confirm("Delete this user?");
    if (!confirmed) return;

    setBusy(true);
    setMessage("");
    try {
      await userApi.remove(id);
      setMessage("User deleted.");
      await loadUsers();
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to delete user.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={createUser} className="card space-y-3">
        <h3 className="font-display text-lg">Create User</h3>
        <div className="grid md:grid-cols-2 gap-2">
          <input
            className="border rounded p-2"
            placeholder="Username"
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
            disabled={busy}
          />
          <input
            className="border rounded p-2"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            disabled={busy}
          />
          <input
            className="border rounded p-2"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            disabled={busy}
          />
          <select
            className="border rounded p-2"
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
            disabled={busy}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.create_person_profile}
            onChange={(event) => setForm({ ...form, create_person_profile: event.target.checked })}
            disabled={busy}
          />
          Create or update linked person profile
        </label>
        {form.create_person_profile ? (
          <div className="grid md:grid-cols-2 gap-2">
            <input
              className="border rounded p-2"
              placeholder="Person Name"
              value={form.person_name}
              onChange={(event) => setForm({ ...form, person_name: event.target.value })}
              disabled={busy}
            />
            <input
              className="border rounded p-2"
              placeholder="Person Department"
              value={form.person_department}
              onChange={(event) => setForm({ ...form, person_department: event.target.value })}
              disabled={busy}
            />
          </div>
        ) : null}
        <button className="rounded bg-accent text-white px-3 py-2 w-fit" disabled={busy}>
          {busy ? "Working..." : "Create User"}
        </button>
      </form>

      {message ? <div className="card text-sm">{message}</div> : null}

      <div className="card overflow-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="font-display text-lg">Users</h3>
          <div className="flex items-center gap-2">
            <input
              className="border rounded p-2 text-sm"
              placeholder="Search username, email, or person"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <button type="button" className="rounded bg-slate-700 text-white px-3 py-2 text-sm" onClick={loadUsers} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>
        <div className="text-xs text-slate-600 mb-2">Showing {users.length} of {totalUsers}</div>
        {loading ? <div className="text-sm mb-2">Loading users...</div> : null}
        {!loading && users.length === 0 ? <div className="text-sm mb-2">No users found.</div> : null}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Username</th>
              <th className="p-2">Email</th>
              <th className="p-2">Role</th>
              <th className="p-2">Linked Person</th>
              <th className="p-2">Created</th>
              <th className="p-2">Reset Password</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr className="border-b" key={user.id}>
                <td className="p-2">{user.username}</td>
                <td className="p-2">{user.email || "-"}</td>
                <td className="p-2">
                  <select
                    className="border rounded p-1"
                    value={user.role}
                    onChange={(event) => updateRole(user.id, event.target.value)}
                    disabled={busy}
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  {user.person_name ? `${user.person_name} (${user.person_department || "N/A"})` : "Not linked"}
                </td>
                <td className="p-2">{new Date(user.created_at).toLocaleString()}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <input
                      className="border rounded p-1"
                      type="password"
                      placeholder="New password"
                      value={resetPasswordByUserId[user.id] || ""}
                      onChange={(event) =>
                        setResetPasswordByUserId((prev) => ({
                          ...prev,
                          [user.id]: event.target.value,
                        }))
                      }
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className="rounded bg-ink text-white px-2 py-1"
                      onClick={() => resetPassword(user.id)}
                      disabled={busy}
                    >
                      Save
                    </button>
                  </div>
                </td>
                <td className="p-2">
                  <button
                    type="button"
                    className="rounded bg-red-600 text-white px-2 py-1"
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

      <div className="card flex items-center justify-between text-sm">
        <span>Page {page}</span>
        <div className="flex gap-2">
          <button type="button" className="rounded bg-slate-700 text-white px-3 py-2" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1 || loading}>
            Previous
          </button>
          <button type="button" className="rounded bg-slate-700 text-white px-3 py-2" onClick={() => setPage((prev) => prev + 1)} disabled={loading || users.length < pageSize || page * pageSize >= totalUsers}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
