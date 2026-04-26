import { useEffect, useState } from "react";
import { personApi } from "../services/api";
import ImageUploader from "../components/ImageUploader";

export default function PersonsPage() {
  const [persons, setPersons] = useState([]);
  const [totalPersons, setTotalPersons] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    department: "",
    create_user_account: false,
    username: "",
    password: "",
    role: "student",
  });
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [editingPersonId, setEditingPersonId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", department: "" });

  const loadPersons = async () => {
    setLoading(true);
    try {
      const { data } = await personApi.list({ page, page_size: pageSize, search });
      const items = data?.items || data || [];
      setPersons(items);
      setTotalPersons(data?.total ?? items.length);
      if (!selectedPersonId && items.length) {
        setSelectedPersonId(items[0].id);
      }
    } catch (error) {
      setUploadMessage(error?.response?.data?.detail || "Failed to load persons. Please login again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPersons();
  }, [page, search]);

  const create = async (event) => {
    event.preventDefault();
    await personApi.create(form);
    setForm({
      name: "",
      email: "",
      department: "",
      create_user_account: false,
      username: "",
      password: "",
      role: "student",
    });
    await loadPersons();
  };

  const upload = async (files) => {
    if (!selectedPersonId) {
      setUploadMessage("Select a person before uploading images.");
      return;
    }
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    setUploading(true);
    setUploadPercent(0);
    setUploadMessage("");

    try {
      const { data } = await personApi.uploadImages(selectedPersonId, formData, {
        onUploadProgress: (event) => {
          if (!event?.total) {
            return;
          }
          const nextPercent = Math.min(100, Math.round((event.loaded * 100) / event.total));
          setUploadPercent(nextPercent);
        },
      });
      const okCount = (data?.results || []).filter((r) => r.status === "ok").length;
      const failed = (data?.results || []).filter((r) => r.status !== "ok");
      setUploadPercent(100);
      if (failed.length) {
        const firstReason = failed[0]?.reason || "Validation failed";
        setUploadMessage(`Uploaded ${okCount} image(s). ${failed.length} failed: ${firstReason}`);
      } else {
        setUploadMessage(`Uploaded ${okCount} image(s) successfully.`);
      }
      await loadPersons();
    } catch (error) {
      setUploadMessage(error?.response?.data?.detail || "Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const selectPerson = (person) => {
    setSelectedPersonId(person.id);
    setUploadMessage("");
  };

  const startEditPerson = (person) => {
    setEditingPersonId(person.id);
    setEditForm({ name: person.name, email: person.email, department: person.department });
    setUploadMessage("");
  };

  const cancelEditPerson = () => {
    setEditingPersonId(null);
    setEditForm({ name: "", email: "", department: "" });
  };

  const updatePerson = async (personId) => {
    if (!personId) {
      setUploadMessage("Select a person to update.");
      return;
    }
    try {
      await personApi.update(personId, editForm);
      setUploadMessage("Person updated successfully.");
      cancelEditPerson();
      await loadPersons();
    } catch (error) {
      setUploadMessage(error?.response?.data?.detail || "Failed to update person.");
    }
  };

  const deletePerson = async (personId) => {
    if (!personId) {
      setUploadMessage("Select a person to delete.");
      return;
    }
    try {
      await personApi.remove(personId);
      setUploadMessage("Person deleted (deactivated) successfully.");
      if (selectedPersonId === personId) {
        setSelectedPersonId(null);
      }
      if (editingPersonId === personId) {
        cancelEditPerson();
      }
      await loadPersons();
    } catch (error) {
      setUploadMessage(error?.response?.data?.detail || "Failed to delete person.");
    }
  };

  return (
    <div className="grid-auto">
      <form onSubmit={create} className="card space-y-2">
        <h3 className="font-display text-lg">Create Person</h3>
        <input className="w-full border rounded p-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="w-full border rounded p-2" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="w-full border rounded p-2" placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.create_user_account}
            onChange={(e) => setForm({ ...form, create_user_account: e.target.checked })}
          />
          Create linked login user
        </label>
        {form.create_user_account ? (
          <>
            <input
              className="w-full border rounded p-2"
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            <input
              className="w-full border rounded p-2"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <select
              className="w-full border rounded p-2"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="student">student</option>
              <option value="teacher">teacher</option>
              <option value="admin">admin</option>
            </select>
          </>
        ) : null}
        <button className="bg-accent text-white rounded px-3 py-2">Create</button>
      </form>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="font-display text-lg">Persons</h3>
          <div className="flex items-center gap-2">
            <input
              className="border rounded p-2 text-sm"
              placeholder="Search name, email, department"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <button
              type="button"
              className="rounded bg-slate-700 text-white px-3 py-2 text-sm"
              onClick={loadPersons}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="text-xs text-slate-600 mb-2">Showing {persons.length} of {totalPersons}</div>
        {loading ? <div className="text-sm mb-2">Loading persons...</div> : null}
        {!loading && persons.length === 0 ? <div className="text-sm mb-2">No persons found.</div> : null}
        <div className="space-y-2 max-h-[360px] overflow-auto">
          {persons.map((person) => (
            <div
              key={person.id}
              className={`w-full rounded p-2 border ${selectedPersonId === person.id ? "bg-sky/20" : "bg-white"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-left flex-1"
                  onClick={() => selectPerson(person)}
                >
                  <div className="font-semibold">{person.name}</div>
                  <div className="text-sm">{person.department}</div>
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded bg-mint text-white px-2 py-1 text-xs"
                    onClick={() => startEditPerson(person)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded bg-red-600 text-white px-2 py-1 text-xs"
                    onClick={() => deletePerson(person.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {editingPersonId === person.id ? (
                <div className="mt-3 space-y-2 border-t pt-2">
                  <input
                    className="w-full border rounded p-2"
                    placeholder="Name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                  <input
                    className="w-full border rounded p-2"
                    placeholder="Email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                  <input
                    className="w-full border rounded p-2"
                    placeholder="Department"
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-accent text-white px-3 py-2 text-sm"
                      onClick={() => updatePerson(person.id)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="rounded bg-slate-700 text-white px-3 py-2 text-sm"
                      onClick={cancelEditPerson}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <ImageUploader
        onUpload={upload}
        selectedPersonId={selectedPersonId}
        uploading={uploading}
        uploadPercent={uploadPercent}
      />

      <div className="card flex items-center justify-between text-sm">
        <span>Page {page}</span>
        <div className="flex gap-2">
          <button type="button" className="rounded bg-slate-700 text-white px-3 py-2" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1 || loading}>
            Previous
          </button>
          <button type="button" className="rounded bg-slate-700 text-white px-3 py-2" onClick={() => setPage((prev) => prev + 1)} disabled={loading || persons.length < pageSize || page * pageSize >= totalPersons}>
            Next
          </button>
        </div>
      </div>

      {uploadMessage ? (
        <div className="card text-sm">
          {uploadMessage}
        </div>
      ) : null}
    </div>
  );
}
