import express from "express";
import User from "../models/User.js";
import { hashValue, verifyValue } from "../utils/password.js";
import { signToken } from "../utils/token.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

function publicUser(u) {
  return {
    id: u._id,
    name: u.name,
    username: u.username,
    role: u.role,
    isVerified: u.isVerified,
    isApproved: u.isApproved,
    createdAt: u.createdAt,
  };
}

router.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    const normalizedUsername = String(username).trim().toLowerCase();
    const exists = await User.findOne({ username: normalizedUsername });
    if (exists) {
      return res.status(409).json({ message: "An account with this username already exists" });
    }

    const user = await User.create({
      username: normalizedUsername,
      passwordHash: hashValue(password),
      isVerified: true,
    });

    res.status(201).json(publicUser(user));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username: String(username || "").trim().toLowerCase() });
    if (!user || !verifyValue(String(password || ""), user.passwordHash)) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    if (!user.isApproved) {
      return res.status(403).json({
        code: "PENDING_APPROVAL",
        message: "Your account is awaiting admin approval",
      });
    }

    const token = signToken({ userId: user._id.toString(), role: user.role });
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(401).json({ message: "Account not found" });
  res.json(publicUser(user));
});

export default router;
