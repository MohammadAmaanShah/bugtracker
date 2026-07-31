import User from "../models/User.js";
import { verifyToken } from "../utils/token.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload?.userId) {
    return res.status(401).json({ message: "Please sign in first" });
  }
  try {
    const user = await User.findById(payload.userId);
    if (!user) return res.status(401).json({ message: "Account not found" });
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}
