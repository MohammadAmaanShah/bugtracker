import { useState, useRef } from "react";
import { createBug } from "../api.js";

export default function BugForm({ userName, onCreated }) {
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setScreenshot(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("role", role);
      formData.append("description", description);
      if (screenshot) formData.append("screenshot", screenshot);

      const bug = await createBug(formData);
      setTitle("");
      setRole("");
      setDescription("");
      setScreenshot(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
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
        Description
        <textarea
          rows="4"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the bug and what you expected..."
          required
        />
      </label>

      <p className="muted reporting-as">Reporting as {userName || "you"}</p>

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

      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit bug"}
      </button>
    </form>
  );
}
