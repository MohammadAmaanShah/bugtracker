import express from "express";
import Action from "../models/Action.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const actions = await Action.find({}).sort({ createdAt: -1 }).limit(300);
    res.json(actions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
