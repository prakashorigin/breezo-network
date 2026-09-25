import bcrypt from "bcryptjs";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { User } from "./models/User.js";

if (!env.BOOTSTRAP_ADMIN_EMAIL || !env.BOOTSTRAP_ADMIN_PASSWORD) throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in backend/.env before seeding the administrator.");
await connectDatabase();
const email = env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
const passwordHash = await bcrypt.hash(env.BOOTSTRAP_ADMIN_PASSWORD, 12);
const existing = await User.findOneAndUpdate({ email }, { $set: { role: "ADMIN" }, $setOnInsert: { name: "BREEZO Administrator", passwordHash } }, { upsert: true, new: true, setDefaultsOnInsert: true });
console.log(`Administrator account ready: ${existing.email}`);
await import("mongoose").then(({ default: mongoose }) => mongoose.disconnect());
