import { useState, useRef, useEffect } from "react";
import { updateBug, fetchVerifiedUsers } from "../api.js";

export const STATUSES = [
  { value: "in_progress", label: "In Progress" },
  { value: "fixed", label: "Fixed" },
];

export function statusLabel(value) {
  const s = STATUSES.find((s) => s.value === value);
  return s ? s.label : value;
}

export default function EditModal({ bug, userName, isAdmin, onClose, onSaved }) {
  const [title, setTitle] = useState(bug.title);
  const [role, setRole] = useState(bug.role);
  const [description, setDescription] = useState(bug.description);
  const [status, setStatus] = useState(bug.status || "in_progress");
  const [reportedBy, setReportedBy] = useState(bug.reportedBy || "");
  const [assignedTo, setAssignedTo] = useState(bug.assignedTo || "");
  const [users, setUsers] = useState([]);
  const [editedBy, setEditedBy] = useState(userName || "");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [removeScreenshot, setRemoveScreenshot] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    fetchVerifiedUsers()
      .then(setUsers)
      .catch(() => {});
  }, []);

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setRemoveScreenshot(false);
    setPreview(URL.createObjectURL(f));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("role", role);
      formData.append("description", description);
      formData.append("status", status);
      if (isAdmin) formData.append("reportedBy", reportedBy);
      formData.append("assignedTo", assignedTo);
      formData.append("editedBy", editedBy);
      if (file) formData.append("screenshot", file);
      if (removeScreenshot) formData.append("removeScreenshot", "true");

      const updated = await updateBug(bug._id, formData);
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const currentImage = file ? preview : bug.screenshot;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form
        className="card modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2>Edit bug</h2>

        <label>
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>

        <label>
          In Role
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
          />
        </label>

        <label>
          Description
          <textarea
            rows="4"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </label>

        {isAdmin && (
          <label>
            Reported by
            <select
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
              required
            >
              <option value="">Select a user</option>
              {users.map((u) => (
                <option key={u._id} value={u.name}>
                  {u.name} (@{u.username})
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          Assign to
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u._id} value={u.name || u.username}>
                {u.name || u.username} (@{u.username})
              </option>
            ))}
          </select>
        </label>

        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Edited by
          <input
            type="text"
            value={editedBy}
            onChange={(e) => setEditedBy(e.target.value)}
            placeholder="Who is making this change?"
            required
          />
        </label>

        <label>
          Screenshot
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
          />
        </label>

        {currentImage && !removeScreenshot && (
          <div className="preview-wrap">
            <img src={currentImage} alt="Current screenshot" />
            {bug.screenshot && !file && (
              <label className="remove-screenshot">
                <input
                  type="checkbox"
                  checked={removeScreenshot}
                  onChange={(e) => setRemoveScreenshot(e.target.checked)}
                />
                Remove current screenshot
              </label>
            )}
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
