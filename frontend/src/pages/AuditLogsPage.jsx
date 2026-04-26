import { useEffect, useState } from "react";
import { auditApi } from "../services/api";

export default function AuditLogsPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actorUsername, setActorUsername] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const pageSize = 20;

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const { data } = await auditApi.list({
        page,
        page_size: pageSize,
        search,
        actor_username: actorUsername || undefined,
        action: action || undefined,
        entity_type: entityType || undefined,
      });
      const nextItems = data?.items || [];
      setItems(nextItems);
      setTotal(data?.total ?? nextItems.length);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to load audit logs.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, search, actorUsername, action, entityType]);

  const resetFilters = () => {
    setPage(1);
    setSearch("");
    setActorUsername("");
    setAction("");
    setEntityType("");
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Audit Logs</h2>
            <p className="text-sm text-slate-600">Recent mutable actions across the system.</p>
          </div>
          <button type="button" className="rounded bg-slate-700 text-white px-3 py-2 text-sm" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-2">
          <input className="border rounded p-2 text-sm" placeholder="Search action, actor, entity" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          <input className="border rounded p-2 text-sm" placeholder="Actor username" value={actorUsername} onChange={(event) => { setActorUsername(event.target.value); setPage(1); }} />
          <input className="border rounded p-2 text-sm" placeholder="Action" value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} />
          <input className="border rounded p-2 text-sm" placeholder="Entity type" value={entityType} onChange={(event) => { setEntityType(event.target.value); setPage(1); }} />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="rounded bg-ink text-white px-3 py-2 text-sm" onClick={load} disabled={loading}>Apply</button>
          <button type="button" className="rounded bg-white border border-slate-200 px-3 py-2 text-sm" onClick={resetFilters} disabled={loading}>Reset</button>
        </div>
      </div>

      {message ? <div className="card text-sm">{message}</div> : null}

      <div className="card overflow-auto">
        <div className="text-xs text-slate-600 mb-2">Showing {items.length} of {total}</div>
        {loading ? <div className="text-sm mb-2">Loading audit logs...</div> : null}
        {!loading && items.length === 0 ? <div className="text-sm mb-2">No audit logs found.</div> : null}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Timestamp</th>
              <th className="p-2">Actor</th>
              <th className="p-2">Action</th>
              <th className="p-2">Entity</th>
              <th className="p-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-b align-top">
                <td className="p-2 whitespace-nowrap">{new Date(row.timestamp).toLocaleString()}</td>
                <td className="p-2 whitespace-nowrap">{row.actor_username} ({row.actor_role})</td>
                <td className="p-2 whitespace-nowrap">{row.action}</td>
                <td className="p-2 whitespace-nowrap">{row.entity_type}{row.entity_id ? ` #${row.entity_id}` : ""}</td>
                <td className="p-2 text-xs text-slate-700 break-all">{row.metadata_json}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card flex items-center justify-between text-sm">
        <span>Page {page}</span>
        <div className="flex gap-2">
          <button type="button" className="rounded bg-slate-700 text-white px-3 py-2" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1 || loading}>Previous</button>
          <button type="button" className="rounded bg-slate-700 text-white px-3 py-2" onClick={() => setPage((prev) => prev + 1)} disabled={loading || items.length < pageSize || page * pageSize >= total}>Next</button>
        </div>
      </div>
    </div>
  );
}