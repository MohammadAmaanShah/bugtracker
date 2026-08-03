import { statusLabel } from "./EditModal.jsx";

const FORMAT_LABELS = {
  pptx: "PowerPoint (.pptx)",
  docx: "Google Docs / Word (.docx)",
  pdf: "PDF (.pdf)",
};

export default function DownloadPreviewModal({ format, bugs, onCancel, onDownload }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="card modal preview-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Preview report</h2>
        <p className="muted preview-meta">
          Format: {FORMAT_LABELS[format] || format} · {bugs.length} bug
          {bugs.length === 1 ? "" : "s"}
        </p>

        {bugs.length === 0 ? (
          <p className="muted">No bugs match this filter.</p>
        ) : (
          <div className="preview-list">
            {bugs.map((bug) => (
              <div className="preview-row" key={bug._id}>
                <div className="preview-row-main">
                  <strong>{bug.title || "Untitled"}</strong>
                  <span className="preview-role">{bug.role || "—"}</span>
                </div>
                <span className="preview-status">{statusLabel(bug.status)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onDownload}
            disabled={bugs.length === 0}
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
