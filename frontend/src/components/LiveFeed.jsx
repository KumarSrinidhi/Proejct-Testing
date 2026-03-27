export default function LiveFeed({ events = [] }) {
  return (
    <div className="card">
      <h3 className="font-display text-lg mb-3">Live Recognition Events</h3>
      <div className="max-h-[420px] overflow-auto space-y-2">
        {events.map((event, idx) => (
          <div key={`${event.timestamp}-${idx}`} className="rounded-xl border border-slate-200 p-3 text-sm bg-white">
            <div className="font-semibold">{event.name || "Unknown"}</div>
            <div>Confidence: {(event.confidence || 0).toFixed(3)}</div>
            <div>Status: {event.message}</div>
            <div>Time: {event.timestamp}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
