import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bugsRouter from "./routes/bugs.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import User from "./models/User.js";
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

const PORT = process.env.PORT;
const MONGODB_URI = process.env.MONGODB_URI;

async function seedAdmin() {
  const exists = await User.findOne({ role: "admin" });
  if (exists) return;
  const phone = process.env.ADMIN_PHONE || "9999999999";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  await User.create({
    name: "Admin",
    phone,
    passwordHash: hashValue(password),
    role: "admin",
    isVerified: true,
    isApproved: true,
  });
  console.log(`Seeded admin account -> phone: ${phone}  password: ${password}`);
}



mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    await seedAdmin();
    app.listen(PORT, () =>
      console.log(`API running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });
