import { useState } from "react";

export default function ImageUploader({ onUpload, selectedPersonId, uploading, uploadPercent = 0 }) {
  const [files, setFiles] = useState([]);

  const submit = async (event) => {
    event.preventDefault();
    if (files.length) {
      await onUpload(files);
      setFiles([]);
    }
  };

  return (
    <form onSubmit={submit} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div className="section-title">Upload Reference Images</div>
      <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", margin: 0 }}>
        {selectedPersonId ? `Selected Person ID: ${selectedPersonId}` : "No person selected"}
      </p>
      <input
        type="file"
        accept="image/jpeg,image/png"
        multiple
        onChange={(event) => setFiles(Array.from(event.target.files || []))}
        className="input"
      />
      <button
        className="btn btn-primary"
        type="submit"
        disabled={uploading || !selectedPersonId || files.length === 0}
      >
        {uploading ? "Uploading..." : "Validate & Upload"}
      </button>
      {uploading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)" }}>
            <span>Upload progress</span>
            <span>{uploadPercent}%</span>
          </div>
          <div style={{ height: 8, width: "100%", overflow: "hidden", borderRadius: 4, background: "rgba(255,255,255,0.05)" }}>
            <div
              style={{ height: "100%", background: "var(--primary)", transition: "width 0.2s", width: `${uploadPercent}%` }}
            />
          </div>
        </div>
      ) : null}
    </form>
  );
}
