import { useEffect, useState } from "react";
import { personApi } from "../services/api";
import ImageUploader from "../components/ImageUploader";

export default function PersonsPage() {
  const [persons, setPersons] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", department: "" });
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const loadPersons = async () => {
    try {
      const { data } = await personApi.list();
      setPersons(data);
      if (!selectedPersonId && data.length) {
        setSelectedPersonId(data[0].id);
      }
    } catch (error) {
      setUploadMessage(error?.response?.data?.detail || "Failed to load persons. Please login again.");
    }
  };

  useEffect(() => {
    loadPersons();
  }, []);

  const create = async (event) => {
    event.preventDefault();
    await personApi.create(form);
    setForm({ name: "", email: "", department: "" });
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
    setUploadMessage("");

    try {
      const { data } = await personApi.uploadImages(selectedPersonId, formData);
      const okCount = (data?.results || []).filter((r) => r.status === "ok").length;
      const failed = (data?.results || []).filter((r) => r.status !== "ok");
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

  return (
    <div className="grid-auto">
      <form onSubmit={create} className="card space-y-2">
        <h3 className="font-display text-lg">Create Person</h3>
        <input className="w-full border rounded p-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="w-full border rounded p-2" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="w-full border rounded p-2" placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
        <button className="bg-accent text-white rounded px-3 py-2">Create</button>
      </form>

      <div className="card">
        <h3 className="font-display text-lg mb-3">Persons</h3>
        <div className="space-y-2 max-h-[360px] overflow-auto">
          {persons.map((person) => (
            <button
              key={person.id}
              className={`w-full text-left rounded p-2 border ${selectedPersonId === person.id ? "bg-sky/20" : "bg-white"}`}
              onClick={() => setSelectedPersonId(person.id)}
            >
              <div className="font-semibold">{person.name}</div>
              <div className="text-sm">{person.department}</div>
            </button>
          ))}
        </div>
      </div>

      <ImageUploader onUpload={upload} selectedPersonId={selectedPersonId} uploading={uploading} />

      {uploadMessage ? (
        <div className="card text-sm">
          {uploadMessage}
        </div>
      ) : null}
    </div>
  );
}
