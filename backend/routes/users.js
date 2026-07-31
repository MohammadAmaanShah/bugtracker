import express from "express";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/verified", requireAuth, async (req, res) => {
  try {
    const users = await User.find({ isApproved: true })
      .sort({ name: 1 })
      .select("name username isVerified isApproved");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
