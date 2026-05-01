export function createRecognitionSocket(config, onMessage, onClose, onError, onOpen) {
  const wsBase = (import.meta.env.VITE_WS_URL || "ws://localhost:8000").replace(/\/$/, "");
  const token = localStorage.getItem("access_token") || "";
  const wsUrl = token ? `${wsBase}/ws/process?token=${encodeURIComponent(token)}` : `${wsBase}/ws/process`;
  console.log("[WS] Connecting to:", wsUrl.replace(token, "***"));
  
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("[WS] Connected, sending config:", config);
    ws.send(JSON.stringify(config));
    if (onOpen) {
      onOpen();
    }
  };

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === "error") {
        console.error("[WS] Server error:", payload.message);
      }
      onMessage(payload);
    } catch (err) {
      console.error("[WS] Failed to parse message:", err);
      onMessage({ type: "error", message: "Invalid WebSocket payload" });
    }
  };

  ws.onerror = (event) => {
    console.error("[WS] Error:", event);
    if (onError) {
      onError();
    }
  };

  ws.onclose = (event) => {
    console.log("[WS] Closed:", event.code, event.reason);
    if (onClose) {
      onClose(event);
    }
  };

  return ws;
}
