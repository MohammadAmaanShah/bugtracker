import { useEffect, useState } from "react";
import { fetchActions } from "../api.js";
import { statusLabel } from "../components/EditModal.jsx";

const ACTION_LABELS = {
  created: "reported",
  status: "changed status to",
  deleted: "deleted",
};

export default function ActivityPage() {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchActions()
      .then(setActions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <div className="admin-head">
        <h2 className="section-title">Activity log</h2>
      </div>

      {loading && <p className="muted">Loading activity...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && actions.length === 0 && (
        <p className="muted">No activity yet.</p>
      )}

      <div className="activity-list">
        {actions.map((a) => (
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
