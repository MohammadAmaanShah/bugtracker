import { useState, useRef, useEffect } from "react";
import { createBug, fetchVerifiedUsers } from "../api.js";

export default function BugForm({ userName, isAdmin, onCreated }) {
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [users, setUsers] = useState([]);
  const [screenshot, setScreenshot] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef(null);
  const submittedTimer = useRef(null);

  useEffect(() => {
    if (!isAdmin) {
      if (userName) setReportedBy(userName);
      return () => clearTimeout(submittedTimer.current);
    }
    fetchVerifiedUsers()
      .then((list) => {
        setUsers(list);
        if (!reportedBy && userName) setReportedBy(userName);
      })
      .catch(() => {});
    return () => clearTimeout(submittedTimer.current);
  }, [userName, isAdmin]);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setScreenshot(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitted(false);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("role", role);
      formData.append("description", description);
      formData.append("reportedBy", reportedBy);
      formData.append("assignedTo", assignedTo);
      if (screenshot) formData.append("screenshot", screenshot);

      const bug = await createBug(formData);
      setTitle("");
      setRole("");
      setDescription("");
      setScreenshot(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      setSubmitted(true);
      submittedTimer.current = setTimeout(() => setSubmitted(false), 4000);
      onCreated(bug);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card bug-form" onSubmit={handleSubmit}>
      <h2>Report a bug</h2>

      <label>
        Title
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Login button does nothing"
          required
        />
      </label>

      <label>
        In Role
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. Admin / Customer / Worker"
          required
        />
      </label>

      <label>
        Reported by
        {isAdmin ? (
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
        ) : (
          <input type="text" value={reportedBy || userName} readOnly />
        )}
      </label>

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
        Description
        <textarea
          rows="4"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the bug and what you expected..."
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

      {preview && (
        <div className="preview-wrap">
          <img src={preview} alt="Screenshot preview" />
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {submitted && (
        <p className="success">Bug submitted successfully!</p>
      )}

      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit bug"}
      </button>
    </form>
  );
}
