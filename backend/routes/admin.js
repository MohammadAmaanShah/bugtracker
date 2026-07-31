import express from "express";
import User from "../models/User.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get("/users", async (req, res) => {
  const users = await User.find({})
    .sort({ createdAt: -1 })
    .select("name username role isVerified isApproved createdAt");
  res.json(users);
});

router.patch("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { approved, role } = req.body;
    if (approved !== undefined) user.isApproved = Boolean(approved);
    if (role === "user" || role === "admin") user.role = role;

    await user.save();
    res.json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
