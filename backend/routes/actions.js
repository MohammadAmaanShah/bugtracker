import express from "express";
import Action from "../models/Action.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const actions = await Action.find({}).sort({ createdAt: -1 }).limit(300);
    res.json(actions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const filter = {};
    if (req.query.from) {
      const from = new Date(req.query.from);
      if (!isNaN(from)) filter.createdAt = { ...filter.createdAt, $gte: from };
    }
    if (req.query.to) {
      const to = new Date(req.query.to);
      if (!isNaN(to)) {
        to.setHours(23, 59, 59, 999);
        filter.createdAt = { ...filter.createdAt, $lte: to };
      }
    }

    if (!filter.createdAt) {
      return res
        .status(400)
        .json({ message: "Provide a date range (from/to) to delete activities" });
    }

    const result = await Action.deleteMany(filter);
    res.json({ message: `${result.deletedCount} activity entr${result.deletedCount === 1 ? "y" : "ies"} deleted` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
