import { useEffect, useState } from "react";
import { auditApi } from "../services/api";
import { formatDateTimeIst } from "../utils/datetime";

const ACTION_BADGE = {
  create: "badge-emerald",
  delete: "badge-rose",
  update: "badge-amber",
  login: "badge-cyan",
  logout: "badge-violet",
};

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
        page, page_size: pageSize, search,
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

  useEffect(() => { load(); }, [page, search, actorUsername, action, entityType]);

  const resetFilters = () => {
    setPage(1);
    setSearch("");
    setActorUsername("");
    setAction("");
    setEntityType("");
  };

  const getActionBadgeClass = (a) => {
    const key = (a || "").toLowerCase();
    for (const [prefix, cls] of Object.entries(ACTION_BADGE)) {
      if (key.includes(prefix)) return cls;
    }
    return "badge-slate";
  };

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div>
        <h1 className="page-title">Audit Logs</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
          Complete record of mutable actions across the system
        </p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="section-title mb-3">Filters</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ position: "relative" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ position: "absolute", left: "0.625rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="input input-sm"
              style={{ paddingLeft: "2rem" }}
              placeholder="Search…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <input className="input input-sm" placeholder="Actor username" value={actorUsername} onChange={(e) => { setActorUsername(e.target.value); setPage(1); }} />
          <input className="input input-sm" placeholder="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
          <input className="input input-sm" placeholder="Entity type" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} />
        </div>
        <div style={{ display: "flex", gap: "0.625rem" }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={load} disabled={loading}>Apply</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters} disabled={loading}>Reset</button>
        </div>
      </div>

      {message && <div className="alert alert-danger animate-fade-in">{message}</div>}

      {/* Table */}
      <div className="card">
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
          Showing <strong style={{ color: "var(--text-secondary)" }}>{items.length}</strong> of {total} records
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />)}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            No audit logs found
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontFamily: "var(--mono, monospace)", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                      {formatDateTimeIst(row.timestamp)}
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 500 }}>{row.actor_username}</div>
                        <span className="badge badge-slate" style={{ fontSize: "0.6rem" }}>{row.actor_role}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getActionBadgeClass(row.action)}`}>{row.action}</span>
                    </td>
                    <td>
                      <span style={{ color: "var(--text-secondary)" }}>{row.entity_type}</span>
                      {row.entity_id && (
                        <span style={{ fontFamily: "var(--mono, monospace)", fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.375rem" }}>
                          #{row.entity_id}
                        </span>
                      )}
                    </td>
                    <td style={{ maxWidth: 260, overflow: "hidden" }}>
                      {row.metadata_json && (
                        <code style={{
                          fontSize: "0.7rem",
                          color: "var(--text-muted)",
                          fontFamily: "var(--mono, monospace)",
                          wordBreak: "break-all",
                          display: "block",
                          maxHeight: "3rem",
                          overflow: "hidden",
                        }}>
                          {row.metadata_json}
                        </code>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="pagination" style={{ marginTop: "1rem", justifyContent: "space-between" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Page {page}</span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>← Prev</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPage((p) => p + 1)} disabled={loading || items.length < pageSize || page * pageSize >= total}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}