export function createRecognitionSocket(config, onMessage, onClose) {
  const wsBase = (import.meta.env.VITE_WS_URL || "ws://localhost:8000").replace(/\/$/, "");
  const ws = new WebSocket(`${wsBase}/ws/process`);

  ws.onopen = () => {
    ws.send(JSON.stringify(config));
  };

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      onMessage(payload);
    } catch (err) {
      onMessage({ type: "error", message: "Invalid WebSocket payload" });
    }
  };

  ws.onclose = () => {
    if (onClose) onClose();
  };

  return ws;
}
