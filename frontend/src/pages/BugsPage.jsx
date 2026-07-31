import { useState, useRef } from "react";
import { fetchBugs } from "../api.js";
import BugCard from "../components/BugCard.jsx";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "in_progress", label: "In Progress" },
  { value: "fixed", label: "Fixed" },
];

const DOWNLOAD_OPTIONS = [
  { value: "", label: "All" },
  { value: "in_progress", label: "In Progress" },
  { value: "fixed", label: "Fixed" },
];

export default function BugsPage({
  bugs,
  setBugs,
  loading,
  setLoading,
  error,
  setError,
  userName,
}) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [format, setFormat] = useState("pptx");
  const [downloading, setDownloading] = useState(false);
  const searchTimer = useRef(null);

  async function loadBugs(overrides = {}) {
    try {
      const data = await fetchBugs({
        q: overrides.q ?? q,
        status: overrides.status ?? statusFilter,
      });
      setBugs(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(value) {
    setQ(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      loadBugs({ q: value, status: statusFilter });
    }, 250);
  }

  function handleStatusFilter(value) {
    setStatusFilter(value);
    loadBugs({ q, status: value });
  }

  function handleCreated(bug) {
    setBugs((prev) => [bug, ...prev]);
  }

  function handleUpdated(updated) {
    setBugs((prev) => prev.map((b) => (b._id === updated._id ? updated : b)));
  }

  function handleDeleted(id) {
    setBugs((prev) => prev.filter((b) => b._id !== id));
  }

  async function handleDownload(status) {
    setDownloading(true);
    try {
      const data = await fetchBugs({ status });
      const { downloadReport } = await import("../downloadReport.js");
      await downloadReport(data, format);
    } catch (err) {
      alert(err.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section>
      <div className="toolbar">
        <input
          type="search"
          className="search-input"
          placeholder="Search by title, role, or description..."
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <div className="status-filters">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`filter-chip ${statusFilter === f.value ? "active" : ""}`}
              onClick={() => handleStatusFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="download-bar card">
        <span className="download-label">Download report</span>
        <select
          className="download-format"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
        >
          <option value="pptx">PowerPoint (.pptx)</option>
          <option value="docx">Google Docs / Word (.docx)</option>
        </select>
        <div className="download-actions">
          {DOWNLOAD_OPTIONS.map((o) => (
            <button
              key={o.value || "all"}
              type="button"
              className="btn-mini"
              disabled={downloading}
              onClick={() => handleDownload(o.value)}
            >
              {downloading ? "Preparing..." : o.label}
            </button>
          ))}
        </div>
      </div>

      <h2 className="section-title">
        Reported bugs <span className="count">{bugs.length}</span>
      </h2>

      {loading && <p className="muted">Loading bugs...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && bugs.length === 0 && (
        <p className="muted">No bugs found.</p>
      )}

      <div className="bug-list">
        {bugs.map((bug) => (
          <BugCard
            key={bug._id}
            bug={bug}
            userName={userName}
            onDeleted={handleDeleted}
            onUpdated={handleUpdated}
          />
        ))}
      </div>
    </section>
  );
}
