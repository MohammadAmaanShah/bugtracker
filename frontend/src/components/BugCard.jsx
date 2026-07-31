import { useState } from "react";
import { deleteBug, updateBug } from "../api.js";
import EditModal, { statusLabel } from "./EditModal.jsx";

const FIELD_LABELS = {
  title: "Title",
  role: "Role",
  description: "Description",
  status: "Status",
  screenshot: "Screenshot",
  reportedBy: "Reported by",
};

const READ_MORE_CHARS = 180;

export default function BugCard({ bug, userName, onDeleted, onUpdated }) {
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const isLongDescription = bug.description.length > READ_MORE_CHARS;

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteBug(bug._id);
      onDeleted(bug._id);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  async function handleStatusChange(e) {
    const next = e.target.value;
    if (next === bug.status) return;
    setStatusBusy(true);
    try {
      const formData = new FormData();
      formData.append("status", next);
      formData.append("editedBy", userName || "Unknown");
      const updated = await updateBug(bug._id, formData);
      onUpdated(updated);
    } catch (err) {
      alert(err.message);
    } finally {
      setStatusBusy(false);
    }
  }

  const history = bug.editHistory || [];

  return (
    <article className="card bug-card">
      <div className="bug-card-head">
        <span className="role-tag">{bug.role}</span>
        <span className={`status-badge status-${bug.status}`}>
          {statusLabel(bug.status)}
        </span>
      </div>

      <h3>{bug.title}</h3>
      <p
        className={`description ${
          isLongDescription ? (expanded ? "expanded" : "collapsed") : ""
        }`}
      >
        {bug.description}
      </p>
      {isLongDescription && (
        <button
          type="button"
          className="read-more"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}

      <div className="meta-line">
        <span>
          {bug.reportedBy ? `Reported by ${bug.reportedBy}` : "Reported"}
        </span>
        <span>{new Date(bug.createdAt).toLocaleDateString()}</span>
      </div>

      {bug.screenshot && (
        <div className="screenshot-wrap" onClick={() => setZoomed(true)}>
          <img src={bug.screenshot} alt={bug.title} />
        </div>
      )}

      {zoomed && (
        <div className="lightbox" onClick={() => setZoomed(false)}>
          <img src={bug.screenshot} alt={bug.title} />
        </div>
      )}

      <div className="status-control">
        <label>
          Status
          <select
            value={bug.status}
            onChange={handleStatusChange}
            disabled={statusBusy}
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="fixed">Fixed</option>
            <option value="closed">Closed</option>
          </select>
        </label>
      </div>

      {history.length > 0 && (
        <div className="history">
          <button
            type="button"
            className="history-toggle"
            onClick={() => setShowHistory((v) => !v)}
          >
            Edit history ({history.length})
            <span className={`chevron ${showHistory ? "open" : ""}`}>
              &#9662;
            </span>
          </button>
          {showHistory && (
            <ul className="history-list">
              {history.map((h) => (
                <li key={h._id}>
                  <span className="history-who">
                    {h.editedBy || "Unknown"}
                  </span>
                  <span className="history-detail">
                    changed {FIELD_LABELS[h.field] || h.field} from{" "}
                    <em>{h.oldValue || "\u2014"}</em> to{" "}
                    <em>{h.newValue || "\u2014"}</em>
                  </span>
                  <span className="history-when">
                    {new Date(h.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card-actions">
        <button
          type="button"
          className="btn-edit"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <button
          type="button"
          className={`btn-delete ${confirming ? "confirm" : ""}`}
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting
            ? "Deleting..."
            : confirming
            ? "Click again to confirm"
            : "Delete"}
        </button>
      </div>

      {editing && (
        <EditModal
          bug={bug}
          userName={userName}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setEditing(false);
            onUpdated(updated);
          }}
        />
      )}
    </article>
  );
}
