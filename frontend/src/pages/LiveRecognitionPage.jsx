import { useRef, useState } from "react";
import LiveFeed from "../components/LiveFeed";
import { createRecognitionSocket } from "../services/websocket";
import { videoApi } from "../services/api";

export default function LiveRecognitionPage() {
  const [events, setEvents] = useState([]);
  const [sourceType, setSourceType] = useState("webcam");
  const [sourcePath, setSourcePath] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const socketRef = useRef(null);

  const uploadVideo = async () => {
    if (!videoFile) {
      setStatusMessage("Choose a video file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", videoFile);
    setUploading(true);
    setStatusMessage("");

    try {
      const { data } = await videoApi.upload(formData);
      setSourceType("file");
      setSourcePath(data.video_path || "");
      setStatusMessage("Video uploaded. You can start live processing now.");
    } catch (error) {
      setStatusMessage(error?.response?.data?.detail || "Video upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const start = () => {
    if (sourceType === "file" && !sourcePath) {
      setStatusMessage("Upload a video or enter a valid server file path.");
      return;
    }
    if (socketRef.current) {
      socketRef.current.close();
    }
    const socket = createRecognitionSocket(
      { source_type: sourceType, source_path: sourcePath || null },
      (payload) => {
        if (payload.type === "recognition") {
          setEvents((prev) => [payload, ...prev].slice(0, 200));
        }
      },
      () => {
        socketRef.current = null;
      }
    );
    setStatusMessage("Processing started.");
    socketRef.current = socket;
  };

  const stop = () => {
    socketRef.current?.close();
    socketRef.current = null;
    setStatusMessage("Processing stopped.");
  };

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap gap-2 items-end">
        <label className="flex flex-col text-sm">
          Source Type
          <select className="border rounded p-2" value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
            <option value="webcam">Webcam</option>
            <option value="file">Video File</option>
            <option value="rtsp">RTSP</option>
          </select>
        </label>
        <label className="flex flex-col text-sm grow">
          Source Path
          <input className="border rounded p-2" value={sourcePath} onChange={(e) => setSourcePath(e.target.value)} />
        </label>
        <label className="flex flex-col text-sm grow">
          Add Video
          <input
            type="file"
            accept="video/mp4,video/avi,video/quicktime,video/x-matroska,video/webm"
            className="border rounded p-2"
            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
          />
        </label>
        <button onClick={uploadVideo} className="rounded bg-accent text-white px-4 py-2" disabled={uploading}>
          {uploading ? "Uploading..." : "Upload Video"}
        </button>
        <button onClick={start} className="rounded bg-mint text-white px-4 py-2">Start</button>
        <button onClick={stop} className="rounded bg-slate-700 text-white px-4 py-2">Stop</button>
      </div>
      {statusMessage ? <div className="card text-sm">{statusMessage}</div> : null}
      <LiveFeed events={events} />
    </div>
  );
}
