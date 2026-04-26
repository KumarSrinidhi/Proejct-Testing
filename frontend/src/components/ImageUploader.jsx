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
    <form onSubmit={submit} className="card space-y-3">
      <h3 className="font-display text-lg">Upload Reference Images</h3>
      <p className="text-sm text-slate-600">
        {selectedPersonId ? `Selected Person ID: ${selectedPersonId}` : "No person selected"}
      </p>
      <input
        type="file"
        accept="image/jpeg,image/png"
        multiple
        onChange={(event) => setFiles(Array.from(event.target.files || []))}
        className="block w-full rounded border p-2"
      />
      <button
        className="rounded-lg bg-accent text-white px-4 py-2 disabled:opacity-60"
        type="submit"
        disabled={uploading || !selectedPersonId || files.length === 0}
      >
        {uploading ? "Uploading..." : "Validate & Upload"}
      </button>
      {uploading ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Upload progress</span>
            <span>{uploadPercent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-slate-200">
            <div
              className="h-full bg-accent transition-all duration-200"
              style={{ width: `${uploadPercent}%` }}
            />
          </div>
        </div>
      ) : null}
    </form>
  );
}
