import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bugsRouter from "./routes/bugs.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import actionsRouter from "./routes/actions.js";
import usersRouter from "./routes/users.js";
import User from "./models/User.js";
import Bug from "./models/Bug.js";
import { hashValue } from "./utils/password.js";


dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => res.json({ message: "Bug Tracker API" }));

app.use("/api/bugs", bugsRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/actions", actionsRouter);
app.use("/api/users", usersRouter);

const PORT = process.env.PORT;
const MONGODB_URI = process.env.MONGODB_URI;

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const passwordHash = hashValue(password);

  const admin = await User.findOne({ role: "admin" });
  if (admin) {
    const taken = await User.exists({ username, _id: { $ne: admin._id } });
    if (taken) {
      console.warn(
        `Admin username '${username}' is taken by another account; keeping existing admin username`
      );
    } else {
      admin.username = username;
    }
    admin.name = "Admin";
    admin.passwordHash = passwordHash;
    admin.isVerified = true;
    admin.isApproved = true;
    await admin.save();
    console.log(
      `Synced admin account -> username: ${admin.username}  password: ${password}`
    );
  } else {
    await User.create({
      name: "Admin",
      username,
      passwordHash,
      role: "admin",
      isVerified: true,
      isApproved: true,
    });
    console.log(`Seeded admin account -> username: ${username}  password: ${password}`);
  }
}

async function migrateLegacyData() {
  const users = await User.find({ username: { $in: [null, "", undefined] } });
  for (const user of users) {
    const base =
      String(user.name || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "user";
    let username = base;
    let suffix = 2;
    while (await User.exists({ username, _id: { $ne: user._id } })) {
      username = `${base}${suffix++}`;
    }
    user.username = username;
    await user.save();
    console.log(`Migrated user '${user.name}' -> username: ${username}`);
  }

  const statusMap = { open: "in_progress", closed: "fixed" };
  for (const [oldStatus, newStatus] of Object.entries(statusMap)) {
    const res = await Bug.updateMany({ status: oldStatus }, { $set: { status: newStatus } });
    if (res.modifiedCount > 0) {
      console.log(`Migrated ${res.modifiedCount} bug(s) status '${oldStatus}' -> '${newStatus}'`);
    }
  }
}

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    await migrateLegacyData();
    await seedAdmin();
    app.listen(PORT, () =>
      console.log(`API running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

