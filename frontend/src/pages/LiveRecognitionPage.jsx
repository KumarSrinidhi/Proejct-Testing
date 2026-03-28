import { useEffect, useRef, useState } from "react";
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
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewMode, setPreviewMode] = useState("idle");
  const [latestFaces, setLatestFaces] = useState([]);
  const [frameSize, setFrameSize] = useState({ width: 1, height: 1 });
  const [currentFps, setCurrentFps] = useState(0);
  const [processingMs, setProcessingMs] = useState(0);
  const socketRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const lastRecognitionTsRef = useRef(0);
  const previewObjectUrlRef = useRef(null);
  const webcamStreamRef = useRef(null);
  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);

  const stopBrowserFrameStream = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  };

  const startBrowserFrameStream = () => {
    stopBrowserFrameStream();
    frameIntervalRef.current = setInterval(() => {
      const socket = socketRef.current;
      const video = videoRef.current;
      const canvas = captureCanvasRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !video || !canvas) return;
      if (video.videoWidth <= 0 || video.videoHeight <= 0) return;

      const targetWidth = 640;
      const ratio = video.videoHeight / video.videoWidth;
      const targetHeight = Math.max(1, Math.round(targetWidth * ratio));
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
      const image = canvas.toDataURL("image/jpeg", 0.75);
      socket.send(JSON.stringify({ type: "frame", image }));
    }, 700);
  };

  const stopLocalPreview = () => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((track) => track.stop());
      webcamStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setPreviewMode("idle");
  };

  const startLocalPreview = async () => {
    stopLocalPreview();
    if (sourceType === "webcam") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        webcamStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setPreviewMode("webcam");
      } catch {
        setStatusMessage("Failed to open webcam preview.");
      }
      return;
    }

    if (sourceType === "file" && previewUrl) {
      setPreviewMode("file");
      return;
    }

    setPreviewMode("idle");
  };

  useEffect(() => {
    return () => {
      stopBrowserFrameStream();
      stopLocalPreview();
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!videoRef.current) return;

    if (previewMode === "webcam" && webcamStreamRef.current) {
      videoRef.current.srcObject = webcamStreamRef.current;
      videoRef.current.play().catch(() => {});
      return;
    }

    if (previewMode === "file") {
      videoRef.current.srcObject = null;
      videoRef.current.play().catch(() => {});
      return;
    }

    videoRef.current.srcObject = null;
  }, [previewMode, previewUrl]);

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
      await startLocalPreview();
    } catch (error) {
      setStatusMessage(error?.response?.data?.detail || "Video upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const start = async () => {
    if (sourceType === "file" && !sourcePath) {
      setStatusMessage("Upload a video or enter a valid server file path.");
      return;
    }
    await startLocalPreview();
    stopBrowserFrameStream();
    if (socketRef.current) {
      socketRef.current.close();
    }

    const wsSourceType = sourceType === "webcam" ? "browser_webcam" : sourceType;
    const socket = createRecognitionSocket(
      { source_type: wsSourceType, source_path: sourcePath || null },
      (payload) => {
        if (payload.type === "recognition") {
          const now = performance.now();
          if (lastRecognitionTsRef.current > 0) {
            const delta = now - lastRecognitionTsRef.current;
            if (delta > 0) {
              setCurrentFps(Number((1000 / delta).toFixed(2)));
            }
          }
          lastRecognitionTsRef.current = now;

          const faces = Array.isArray(payload.faces) ? payload.faces : [];
          if (faces.length > 0) {
            const faceEvents = faces.map((face) => ({
              ...payload,
              person_id: face.person_id,
              name: face.name,
              confidence: face.confidence,
              attendance_marked: face.attendance_marked,
              message: face.message,
              bbox: face.bbox,
            }));
            setEvents((prev) => [...faceEvents, ...prev].slice(0, 200));
          } else {
            setEvents((prev) => [payload, ...prev].slice(0, 200));
          }
          setLatestFaces(faces);
          setProcessingMs(Number(payload.processing_ms || 0));
          if (payload.frame_width && payload.frame_height) {
            setFrameSize({ width: payload.frame_width, height: payload.frame_height });
          }
          return;
        }

        if (payload.type === "error") {
          setStatusMessage(payload.message || "Stream processing failed.");
          return;
        }

        if (payload.type === "done") {
          setStatusMessage("Stream completed.");
        }
      },
      () => {
        stopBrowserFrameStream();
        socketRef.current = null;
      }
    );
    if (sourceType === "webcam") {
      setStatusMessage("Processing started using browser webcam.");
      socketRef.current = socket;
      startBrowserFrameStream();
      return;
    }
    setStatusMessage("Processing started.");
    socketRef.current = socket;
  };

  const stop = () => {
    stopBrowserFrameStream();
    if (socketRef.current?.readyState === WebSocket.OPEN && sourceType === "webcam") {
      socketRef.current.send(JSON.stringify({ type: "stop" }));
    }
    socketRef.current?.close();
    socketRef.current = null;
    stopLocalPreview();
    setLatestFaces([]);
    setCurrentFps(0);
    setProcessingMs(0);
    lastRecognitionTsRef.current = 0;
    setStatusMessage("Processing stopped.");
  };

  const clearEvents = () => {
    setEvents([]);
    setLatestFaces([]);
    setCurrentFps(0);
    setProcessingMs(0);
    lastRecognitionTsRef.current = 0;
    setStatusMessage("Events cleared.");
  };

  const handleVideoFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setVideoFile(file);
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      previewObjectUrlRef.current = objectUrl;
      setPreviewUrl(objectUrl);
      setSourceType("file");
    } else {
      setPreviewUrl("");
    }
  };

  const getBoxStyle = (bbox) => ({
    left: `${(bbox[0] / frameSize.width) * 100}%`,
    top: `${(bbox[1] / frameSize.height) * 100}%`,
    width: `${((bbox[2] - bbox[0]) / frameSize.width) * 100}%`,
    height: `${((bbox[3] - bbox[1]) / frameSize.height) * 100}%`,
  });

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
            onChange={handleVideoFileChange}
          />
        </label>
        <button onClick={uploadVideo} className="rounded bg-accent text-white px-4 py-2" disabled={uploading}>
          {uploading ? "Uploading..." : "Upload Video"}
        </button>
        <button onClick={start} className="rounded bg-mint text-white px-4 py-2">Start</button>
        <button onClick={stop} className="rounded bg-slate-700 text-white px-4 py-2">Stop</button>
      </div>
      {statusMessage ? <div className="card text-sm">{statusMessage}</div> : null}

      <div className="card">
        <h3 className="font-display text-lg mb-3">Live Preview</h3>
        <canvas ref={captureCanvasRef} className="hidden" />
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
          <video
            ref={videoRef}
            className={`w-full h-full object-fill ${previewMode === "idle" ? "hidden" : "block"}`}
            autoPlay
            muted
            playsInline
            controls={previewMode === "file"}
            loop={previewMode === "file"}
            src={previewMode === "file" ? previewUrl : undefined}
          />
          {previewMode === "idle" ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-200 text-sm">
              Start processing to show preview
            </div>
          ) : null}

          {previewMode !== "idle" ? (
            <div className="absolute top-2 left-2 bg-black/70 text-white text-xs rounded px-2 py-1 space-y-0.5">
              <div>FPS: {currentFps.toFixed(2)}</div>
              <div>Processing: {processingMs.toFixed(2)} ms</div>
              <div>Faces: {latestFaces.length}</div>
            </div>
          ) : null}

          {latestFaces.map((face, idx) => {
            if (!Array.isArray(face.bbox) || face.bbox.length < 4) {
              return null;
            }
            const boxStyle = getBoxStyle(face.bbox);
            const label = `${face.name || "Unknown"} (${Number(face.confidence || 0).toFixed(2)})`;
            return (
              <div key={`face-${idx}`}>
                <div className="absolute border-2 border-lime-400" style={boxStyle} />
                <div
                  className="absolute bg-lime-500/90 text-black text-xs font-semibold px-2 py-1 rounded"
                  style={{
                    left: boxStyle.left,
                    top: `calc(${boxStyle.top} - 28px)`,
                  }}
                >
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <LiveFeed events={events} onClear={clearEvents} />
    </div>
  );
}
