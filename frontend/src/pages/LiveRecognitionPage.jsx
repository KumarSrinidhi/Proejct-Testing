import { useEffect, useRef, useState } from "react";
import LiveFeed from "../components/LiveFeed";
import { createRecognitionSocket } from "../services/websocket";
import { videoApi } from "../services/api";

const STATE_COLORS = {
  connected: "#10b981",
  connecting: "#f59e0b",
  reconnecting: "#f59e0b",
  error: "#f43f5e",
  idle: "#64748b",
};

const STATE_LABELS = {
  connected: "Connected",
  connecting: "Connecting…",
  reconnecting: "Reconnecting…",
  error: "Error",
  idle: "Idle",
};

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
  const [connectionState, setConnectionState] = useState("idle");
  const socketRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const lastRecognitionTsRef = useRef(0);
  const previewObjectUrlRef = useRef(null);
  const webcamStreamRef = useRef(null);
  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const manualStopRef = useRef(false);
  const activeStreamConfigRef = useRef(null);
  const sourceTypeRef = useRef(sourceType);
  const uploadControllerRef = useRef(null);

  useEffect(() => { sourceTypeRef.current = sourceType; }, [sourceType]);

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
  };
  const stopBrowserFrameStream = () => {
    if (frameIntervalRef.current) { clearInterval(frameIntervalRef.current); frameIntervalRef.current = null; }
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
      const payload = JSON.stringify({ type: "frame", image });
      // Drop frame if buffer exceeds ~1MB to prevent memory leak on slow networks
      if (socket.bufferedAmount > 1024 * 1024) {
        return;
      }
      socket.send(payload);
    }, 700);
  };
  const stopLocalPreview = () => {
    if (webcamStreamRef.current) { webcamStreamRef.current.getTracks().forEach((t) => t.stop()); webcamStreamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setPreviewMode("idle");
  };
  const startLocalPreview = async () => {
    console.log("[Live] startLocalPreview called, sourceType:", sourceType, "previewMode before:", previewMode);
    stopLocalPreview();
    if (sourceType === "webcam") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        webcamStreamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        setPreviewMode("webcam");
        console.log("[Live] Set previewMode to webcam");
      } catch { setStatusMessage("Failed to open webcam preview."); }
      return;
    }
    if (sourceType === "file" && previewUrl) { setPreviewMode("file"); console.log("[Live] Set previewMode to file"); return; }
    if (sourceType === "rtsp") { setPreviewMode("rtsp"); console.log("[Live] Set previewMode to rtsp"); return; }
    setPreviewMode("idle");
    console.log("[Live] Set previewMode to idle");
  };

  useEffect(() => {
    return () => {
      manualStopRef.current = true;
      clearReconnectTimer();
      stopBrowserFrameStream();
      stopLocalPreview();
      if (previewObjectUrlRef.current) { URL.revokeObjectURL(previewObjectUrlRef.current); previewObjectUrlRef.current = null; }
      if (uploadControllerRef.current) { uploadControllerRef.current.abort(); uploadControllerRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!videoRef.current) return;
    if (previewMode === "webcam" && webcamStreamRef.current) {
      videoRef.current.srcObject = webcamStreamRef.current;
      videoRef.current.play().catch(() => {});
      return;
    }
    if (previewMode === "file") { videoRef.current.srcObject = null; videoRef.current.play().catch(() => {}); return; }
    videoRef.current.srcObject = null;
  }, [previewMode, previewUrl]);

  const connectSocket = (streamConfig) => {
    console.log("[Live] connectSocket called, setting connectionState to connecting");
    setConnectionState("connecting");
    const socket = createRecognitionSocket(
      streamConfig,
      (payload) => {
        if (payload.type === "recognition") {
          const now = performance.now();
          if (lastRecognitionTsRef.current > 0) {
            const delta = now - lastRecognitionTsRef.current;
            if (delta > 0) setCurrentFps(Number((1000 / delta).toFixed(2)));
          }
          lastRecognitionTsRef.current = now;
          const faces = Array.isArray(payload.faces) ? payload.faces : [];
          if (faces.length > 0) {
            const faceEvents = faces.map((face) => ({ ...payload, person_id: face.person_id, name: face.name, confidence: face.confidence, attendance_marked: face.attendance_marked, message: face.message, bbox: face.bbox }));
            setEvents((prev) => [...faceEvents, ...prev].slice(0, 200));
          } else {
            setEvents((prev) => [payload, ...prev].slice(0, 200));
          }
          setLatestFaces(faces);
          setProcessingMs(Number(payload.processing_ms || 0));
          if (payload.frame_width && payload.frame_height) setFrameSize({ width: payload.frame_width, height: payload.frame_height });
          return;
        }
        if (payload.type === "error") { setStatusMessage(payload.message || "Stream processing failed."); return; }
        if (payload.type === "done") setStatusMessage("Stream completed.");
      },
      () => {
        stopBrowserFrameStream();
        socketRef.current = null;
        if (manualStopRef.current) { setConnectionState("idle"); return; }
        const nextAttempt = reconnectAttemptsRef.current + 1;
        reconnectAttemptsRef.current = nextAttempt;
        if (nextAttempt > 10) { setConnectionState("error"); setStatusMessage("Connection lost. Retry limit reached."); return; }
        const delayMs = Math.min(1000 * 2 ** (nextAttempt - 1), 10000);
        setConnectionState("reconnecting");
        setStatusMessage(`Connection lost. Reconnecting in ${Math.round(delayMs / 1000)}s…`);
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          if (!manualStopRef.current && activeStreamConfigRef.current) {
            connectSocket(activeStreamConfigRef.current);
            if (activeStreamConfigRef.current.source_type === "browser_webcam") {
              startBrowserFrameStream();
            }
          }
        }, delayMs);
      },
      () => { 
        const isRtsp = sourceTypeRef.current === "rtsp";
        setConnectionState("error"); 
        setStatusMessage(isRtsp ? "Failed to connect to RTSP stream. Check URL and network." : "WebSocket connection failed."); 
      },
      () => { reconnectAttemptsRef.current = 0; setConnectionState("connected"); }
    );
    socketRef.current = socket;
  };

  const uploadVideo = async () => {
    if (!videoFile) { setStatusMessage("Choose a video file first."); return; }
    const formData = new FormData();
    formData.append("file", videoFile);
    setUploading(true);
    setStatusMessage("");
    const controller = new AbortController();
    uploadControllerRef.current = controller;
    try {
      const { data } = await videoApi.upload(formData, { signal: controller.signal });
      setSourceType("file");
      setSourcePath(data.video_path || "");
      setStatusMessage("Video uploaded. You can start live processing now.");
      await startLocalPreview();
    } catch (error) {
      if (error.name === 'AbortError') return;
      setStatusMessage(error?.response?.data?.detail || "Video upload failed.");
    } finally {
      setUploading(false);
      uploadControllerRef.current = null;
    }
  };

  const start = async () => {
    console.log("[Live] Start called, sourceType:", sourceType, "sourcePath:", sourcePath);
    if (sourceType === "file" && !sourcePath) { setStatusMessage("Upload a video or enter a valid server file path."); return; }
    if (sourceType === "rtsp" && !sourcePath) { setStatusMessage("Enter a valid RTSP URL."); return; }
    await startLocalPreview();
    manualStopRef.current = false;
    clearReconnectTimer();
    reconnectAttemptsRef.current = 0;
    stopBrowserFrameStream();
    if (socketRef.current) socketRef.current.close();
    const wsSourceType = sourceType === "webcam" ? "browser_webcam" : sourceType;
    const streamConfig = { source_type: wsSourceType, source_path: sourcePath || null };
    console.log("[Live] Connecting with config:", streamConfig);
    activeStreamConfigRef.current = streamConfig;
    connectSocket(streamConfig);
    if (sourceType === "webcam") { setStatusMessage("Processing started using browser webcam."); startBrowserFrameStream(); return; }
    setStatusMessage("Processing started - connecting to stream...");
  };

  const stop = () => {
    manualStopRef.current = true;
    clearReconnectTimer();
    stopBrowserFrameStream();
    if (socketRef.current?.readyState === WebSocket.OPEN && sourceType === "webcam") {
      socketRef.current.send(JSON.stringify({ type: "stop" }));
    }
    socketRef.current?.close();
    socketRef.current = null;
    activeStreamConfigRef.current = null;
    stopLocalPreview();
    setLatestFaces([]);
    setCurrentFps(0);
    setProcessingMs(0);
    setConnectionState("idle");
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
    if (previewObjectUrlRef.current) { URL.revokeObjectURL(previewObjectUrlRef.current); previewObjectUrlRef.current = null; }
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
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div>
        <h1 className="page-title">Live Recognition</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
          Real-time face detection and attendance marking via webcam, video file, or RTSP stream
        </p>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="section-title mb-4">Stream Configuration</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
          {/* Source type */}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.375rem", fontWeight: 500 }}>
              Source Type
            </label>
            <select
              id="live-source-type"
              className="input"
              style={{ width: 160 }}
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
            >
              <option value="webcam">Webcam</option>
              <option value="file">Video File</option>
              <option value="rtsp">RTSP Stream</option>
            </select>
          </div>

          {/* RTSP path */}
          {sourceType === "rtsp" && (
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.375rem", fontWeight: 500 }}>
                RTSP URL
              </label>
              <input
                className="input"
                placeholder="rtsp://…"
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
              />
            </div>
          )}

          {/* File upload */}
          {sourceType === "file" && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem", flex: 1, minWidth: 200 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.375rem", fontWeight: 500 }}>
                  Video File
                </label>
                <input
                  type="file"
                  accept="video/mp4,video/avi,video/quicktime,video/x-matroska,video/webm"
                  className="input"
                  onChange={handleVideoFileChange}
                />
              </div>
              <button onClick={uploadVideo} className="btn btn-secondary" disabled={uploading} style={{ flexShrink: 0 }}>
                {uploading ? (
                  <>
                    <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "var(--text-primary)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    Uploading…
                  </>
                ) : "Upload"}
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "0.625rem" }}>
            <button
              id="live-start-btn"
              onClick={start}
              className="btn btn-primary"
              disabled={connectionState === "connected" || connectionState === "connecting"}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Start
            </button>
            <button
              id="live-stop-btn"
              onClick={stop}
              className="btn btn-danger"
              disabled={connectionState === "idle"}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
              Stop
            </button>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="card" style={{ padding: "0.75rem 1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div className={`status-dot ${connectionState}`} />
            <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>
              {STATE_LABELS[connectionState] || connectionState}
            </span>
          </div>
          {statusMessage && (
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>— {statusMessage}</span>
          )}
        </div>
      </div>

      {/* Video Preview + Stats */}
      <div className="card">
        <div className="section-header">
          <div className="section-title">Live Preview</div>
          {previewMode !== "idle" && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <span className="badge badge-cyan">
                {currentFps.toFixed(1)} FPS
              </span>
              <span className="badge badge-violet">
                {processingMs.toFixed(0)} ms
              </span>
              <span className="badge badge-emerald">
                {latestFaces.length} faces
              </span>
            </div>
          )}
        </div>

        <canvas ref={captureCanvasRef} style={{ display: "none" }} />

        <div className="video-container" style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#000", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          <video
            ref={videoRef}
            style={{
              width: "100%", height: "100%", objectFit: "contain",
              display: previewMode === "idle" || previewMode === "rtsp" ? "none" : "block",
            }}
            autoPlay
            muted
            playsInline
            controls={previewMode === "file"}
            loop={previewMode === "file"}
            src={previewMode === "file" ? previewUrl : undefined}
          />

          {previewMode === "idle" && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "0.75rem",
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.875rem" }}>
                Start processing to show preview
              </p>
            </div>
          )}

          {previewMode === "rtsp" && connectionState !== "idle" && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "0.75rem",
              background: "linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(59,130,246,0.1) 100%)",
            }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--success-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--success)", animation: "pulse 2s infinite" }} />
              </div>
              <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.875rem", fontWeight: 500 }}>
                RTSP Stream Connected
              </p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem" }}>
                Processing on server - frames appear below
              </p>
            </div>
          )}

          {previewMode === "rtsp" && connectionState === "idle" && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "0.75rem",
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                <path d="M2 12h2l3-9 4 18 4-9 3 9h6" />
              </svg>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.875rem" }}>
                Enter RTSP URL and click Start
              </p>
            </div>
          )}

          {/* Face overlays */}
          {latestFaces.map((face, idx) => {
            if (!Array.isArray(face.bbox) || face.bbox.length < 4) return null;
            const boxStyle = getBoxStyle(face.bbox);
            const isKnown = face.person_id && face.name !== "Unknown";
            const color = isKnown ? "var(--success)" : "var(--warning)";
            const bgMap = isKnown ? "var(--success-bg)" : "var(--warning-bg)";
            const label = `${face.name || "Unknown"} (${Number(face.confidence || 0).toFixed(2)})`;
            return (
              <div key={`face-${idx}`}>
                <div 
                  className="face-box" 
                  style={{ 
                    ...boxStyle, 
                    position: "absolute",
                    border: `2px solid ${color}`,
                    borderRadius: "4px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15), inset 0 0 0 1px rgba(255,255,255,0.2)",
                    pointerEvents: "none"
                  }} 
                />
                <div
                  className="face-label"
                  style={{ 
                    ...boxStyle, 
                    position: "absolute", 
                    top: `calc(${boxStyle.top} - 28px)`, 
                    width: "auto", 
                    height: "auto",
                    background: bgMap,
                    color: color,
                    border: `1px solid ${color}`,
                    padding: "2px 8px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    transform: "translateY(-4px)",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    pointerEvents: "none",
                    zIndex: 10
                  }}
                >
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Feed */}
      <LiveFeed events={events} onClear={clearEvents} />

      <style>{`
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.1); } }
`}</style>
    </div>
  );
}
