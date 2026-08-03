import express from "express";
import multer from "multer";
import Bug from "../models/Bug.js";
import Action from "../models/Action.js";
import { upload } from "../middleware/upload.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { parseImportFile } from "../utils/importParser.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "..", "uploads");

const removeFile = (screenshotPath) => {
  if (!screenshotPath) return;
  const filePath = path.join(uploadDir, path.basename(screenshotPath));
  fs.unlink(filePath, () => { });
};

const actorName = (user) => user.name || user.username || "Unknown";

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".csv", ".xlsx", ".pptx", ".docx", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error("Only CSV, Excel (.xlsx), PPT (.pptx), DOCX, and PDF files are allowed"));
  },
});

router.get("/", async (req, res) => {
  try {
    const { q, status } = req.query;
    const filter = {};

    if (status) filter.status = status;

    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: rx }, { role: rx }, { description: rx }];
    }

    const bugs = await Bug.find(filter).sort({ createdAt: -1 });
    res.json(bugs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/import", requireAuth, importUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const { bugs, skipped } = await parseImportFile(
      req.file.buffer,
      req.file.originalname
    );

    if (bugs.length === 0) {
      const details =
        skipped.length > 0
          ? ` ${skipped.length} row(s) skipped (${skipped
              .slice(0, 5)
              .map((s) => `row ${s.row}: ${s.reason}`)
              .join("; ")}).`
          : "";
      return res.status(400).json({
        message: `No valid bug rows found in the file.${details} Make sure each bug has a Title, In Role, and Description (e.g. use the app's PDF report export, or lines like "Title: ...", "In Role: ...", "Description: ...").`,
        skipped,
      });
    }

    const created = await Bug.create(
      bugs.map((b) => ({
        ...b,
        reportedBy:
          req.user.role === "admin"
            ? b.reportedBy || actorName(req.user)
            : actorName(req.user),
      }))
    );
    const actor = actorName(req.user);

    for (const bug of created) {
      await Action.create({
        action: "created",
        actor,
        bugId: bug._id,
        bugTitle: bug.title,
        newValue: statusLabel(bug.status),
      });
    }

    res.status(201).json({ imported: created.length, skipped, bugs: created });
  } catch (err) {
    res.status(400).json({ message: err.message, skipped: [] });
  }
});

router.post("/", requireAuth, upload.single("screenshot"), async (req, res) => {
  try {
    const { title, role, description } = req.body;
    const screenshot = req.file ? `/uploads/${req.file.filename}` : null;
    const isAdmin = req.user.role === "admin";
    const submittedBy = (req.body.reportedBy || "").trim();
    const reportedBy = isAdmin
      ? submittedBy || actorName(req.user)
      : actorName(req.user);
    const assignedTo = (req.body.assignedTo || "").trim();

    const bug = await Bug.create({
      title,
      role,
      description,
      screenshot,
      reportedBy,
      assignedTo,
    });

    await Action.create({
      action: "created",
      actor: actorName(req.user),
      bugId: bug._id,
      bugTitle: bug.title,
      newValue: statusLabel(bug.status),
    });

    res.status(201).json(bug);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", requireAuth, upload.single("screenshot"), async (req, res) => {
  try {
    const bug = await Bug.findById(req.params.id);
    if (!bug) return res.status(404).json({ message: "Bug not found" });

    const {
      title,
      role,
      description,
      status,
      assignedTo,
      editedBy,
    } = req.body;
    const isAdmin = req.user.role === "admin";
    const editor = (editedBy || "").trim() || actorName(req.user);
    const changes = [];

    const submittedReportedBy = String(req.body.reportedBy ?? "").trim();
    if (
      !isAdmin &&
      submittedReportedBy &&
      submittedReportedBy !== actorName(req.user)
    ) {
      return res
        .status(403)
        .json({ message: "Only admins can set Reported by to another user" });
    }
    const reportedBy = isAdmin
      ? submittedReportedBy
      : bug.reportedBy || "";

    const textFields = [
      { key: "title", old: bug.title, next: title },
      { key: "role", old: bug.role, next: role },
      { key: "description", old: bug.description, next: description },
      { key: "status", old: bug.status, next: status },
      { key: "reportedBy", old: bug.reportedBy, next: reportedBy },
      { key: "assignedTo", old: bug.assignedTo || "", next: assignedTo },
    ];

    for (const { key, old: oldVal, next: newVal } of textFields) {
      if (newVal !== undefined && newVal !== oldVal) {
        changes.push({ field: key, oldValue: oldVal, newValue: newVal });
      }
    }

    if (req.file) {
      changes.push({
        field: "screenshot",
        oldValue: bug.screenshot,
        newValue: `/uploads/${req.file.filename}`,
      });
      removeFile(bug.screenshot);
      bug.screenshot = `/uploads/${req.file.filename}`;
    } else if (req.body.removeScreenshot === "true" && bug.screenshot) {
      changes.push({
        field: "screenshot",
        oldValue: bug.screenshot,
        newValue: null,
      });
      removeFile(bug.screenshot);
      bug.screenshot = null;
    }

    if (title !== undefined) bug.title = title;
    if (role !== undefined) bug.role = role;
    if (description !== undefined) bug.description = description;
    if (status !== undefined) bug.status = status;
    bug.reportedBy = reportedBy;
    if (assignedTo !== undefined) bug.assignedTo = String(assignedTo).trim();

    for (const change of changes) {
      bug.editHistory.push({ editedBy: editor, ...change });
    }

    const statusChange = changes.find((c) => c.field === "status");
    if (statusChange) {
      await Action.create({
        action: "status",
        actor: editor,
        bugId: bug._id,
        bugTitle: bug.title,
        oldValue: statusLabel(statusChange.oldValue),
        newValue: statusLabel(statusChange.newValue),
      });
    }

    await bug.save();
    res.json(bug);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const bug = await Bug.findById(req.params.id);
    if (!bug) return res.status(404).json({ message: "Bug not found" });

    await Action.create({
      action: "deleted",
      actor: actorName(req.user),
      bugId: bug._id,
      bugTitle: bug.title,
    });

    removeFile(bug.screenshot);

    await bug.deleteOne();
    res.json({ message: "Bug deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function statusLabel(value) {
  if (value === "in_progress") return "In Progress";
  if (value === "fixed") return "Fixed";
  return value;
}

export default router;
