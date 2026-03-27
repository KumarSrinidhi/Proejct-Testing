import { useRef, useState } from "react";
import LiveFeed from "../components/LiveFeed";
import { createRecognitionSocket } from "../services/websocket";

export default function LiveRecognitionPage() {
  const [events, setEvents] = useState([]);
  const [sourceType, setSourceType] = useState("webcam");
  const [sourcePath, setSourcePath] = useState("");
  const socketRef = useRef(null);

  const start = () => {
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
    socketRef.current = socket;
  };

  const stop = () => {
    socketRef.current?.close();
    socketRef.current = null;
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
        <button onClick={start} className="rounded bg-mint text-white px-4 py-2">Start</button>
        <button onClick={stop} className="rounded bg-slate-700 text-white px-4 py-2">Stop</button>
      </div>
      <LiveFeed events={events} />
    </div>
  );
}
