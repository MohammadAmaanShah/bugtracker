import { useEffect, useState } from "react";
import { fetchActions, deleteActions } from "../api.js";
import { statusLabel } from "../components/EditModal.jsx";

const ACTION_LABELS = {
  created: "reported",
  status: "changed status to",
  deleted: "deleted",
};

function inRange(ts, from, to) {
  if (!from && !to) return true;
  const d = new Date(ts);
  if (from) {
    const f = new Date(from);
    if (d < f) return false;
  }
  if (to) {
    const t = new Date(to);
    t.setHours(23, 59, 59, 999);
    if (d > t) return false;
  }
  return true;
}

export default function ActivityPage({ isAdmin }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      setActions(await fetchActions());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDeleteFiltered() {
    if (!from && !to) {
      alert("Select a date range first.");
      return;
    }
    if (!window.confirm("Delete all activity in the selected date range?")) {
      return;
    }
    setDeleting(true);
    try {
      const res = await deleteActions({ from, to });
      alert(res.message);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const filtered = actions.filter((a) => inRange(a.createdAt, from, to));

  return (
    <section>
      <div className="admin-head">
        <h2 className="section-title">Activity log</h2>
      </div>

      <div className="activity-filters card">
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        {isAdmin && (
          <button
            type="button"
            className="btn-mini btn-delete-user"
            onClick={handleDeleteFiltered}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete filtered"}
          </button>
        )}
      </div>

      {loading && <p className="muted">Loading activity...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p className="muted">No activity in this date range.</p>
      )}

      <div className="activity-list">
        {filtered.map((a) => (
          <div className="activity-row card" key={a._id}>
            <div className="activity-main">
              <strong className="activity-actor">{a.actor}</strong>
              <span className="activity-detail">
                {ACTION_LABELS[a.action] || a.action}
                {a.action === "status"
                  ? ` ${statusLabel(a.oldValue)} → ${statusLabel(a.newValue)}`
                  : ""}
                {a.bugTitle ? (
                  <>
                    {" "}
                    bug: <em>{a.bugTitle}</em>
                  </>
                ) : null}
              </span>
            </div>
            <span className="history-when">
              {new Date(a.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
