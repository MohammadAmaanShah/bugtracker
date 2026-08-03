import { useState, useRef } from "react";
import { fetchBugs, importBugs } from "../api.js";
import BugCard from "../components/BugCard.jsx";
import DownloadPreviewModal from "../components/DownloadPreviewModal.jsx";

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
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const searchTimer = useRef(null);
  const importFileRef = useRef(null);

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
    try {
      const data = await fetchBugs({ status });
      setPreview({ status, data, format });
    } catch (err) {
      setError(err.message);
    }
  }

  async function doDownload() {
    if (!preview) return;
    setDownloading(true);
    try {
      const { downloadReport } = await import("../downloadReport.js");
      await downloadReport(preview.data, preview.format);
      setPreview(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setDownloading(false);
    }
  }

  async function handleImportFile(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await importBugs(formData);
      setImportResult(res);
      loadBugs();
    } catch (err) {
      setImportResult({ error: err.message });
    } finally {
      setImporting(false);
    }
  }

  const skippedCount = importResult?.skipped?.length || 0;

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
          <option value="pdf">PDF (.pdf)</option>
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
              {o.label}
            </button>
          ))}
        </div>
        <span className="download-sep" />
        <button
          type="button"
          className="btn-mini btn-import"
          onClick={() => importFileRef.current?.click()}
          disabled={importing}
        >
          {importing ? "Importing..." : "Import bugs"}
        </button>
        <input
          ref={importFileRef}
          type="file"
          hidden
          accept=".csv,.xlsx,.pptx,.docx,.pdf"
          onChange={handleImportFile}
        />
      </div>

      {importResult && (
        <div
          className={`import-result card ${
            importResult.error ? "import-result-error" : ""
          }`}
        >
          {importResult.error ? (
            <p className="error">{importResult.error}</p>
          ) : (
            <>
              <p className="success">
                Imported {importResult.imported} bug
                {importResult.imported === 1 ? "" : "s"}
                {skippedCount > 0
                  ? ` · ${skippedCount} row${skippedCount === 1 ? "" : "s"} skipped`
                  : ""}
              </p>
              {skippedCount > 0 && (
                <ul className="skip-list">
                  {importResult.skipped.map((s, i) => (
                    <li key={i}>
                      Row {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

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

      {preview && (
        <DownloadPreviewModal
          format={preview.format}
          bugs={preview.data}
          onCancel={() => setPreview(null)}
          onDownload={doDownload}
        />
      )}
    </section>
  );
}
