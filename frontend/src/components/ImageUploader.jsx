import { useState } from "react";

export default function ImageUploader({ onUpload }) {
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
      <input
        type="file"
        accept="image/jpeg,image/png"
        multiple
        onChange={(event) => setFiles(Array.from(event.target.files || []))}
        className="block w-full rounded border p-2"
      />
      <button className="rounded-lg bg-accent text-white px-4 py-2" type="submit">
        Validate & Upload
      </button>
    </form>
  );
}
