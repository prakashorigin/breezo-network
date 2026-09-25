import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { User } from "../models/User.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../config/env.js";

const router = Router();
const credentials = z.object({ email: z.string().email().max(254).transform((value) => value.toLowerCase()), password: z.string().min(8).max(128) });
const issueToken = (user: { id: string; email: string; name: string; role: string }) => jwt.sign({ email: user.email, name: user.name, role: user.role }, env.JWT_SECRET, { subject: user.id, expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
const dto = (user: { _id: unknown; email: string; name: string; role: string }) => ({ id: String(user._id), email: user.email, name: user.name, role: user.role });

router.post("/register", asyncHandler(async (req, res) => {
  const body = credentials.extend({ name: z.string().trim().min(2).max(80) }).parse(req.body);
  const exists = await User.exists({ email: body.email });
  if (exists) return res.status(409).json({ success: false, message: "An account with this email already exists" });
  const user = await User.create({ name: body.name, email: body.email, passwordHash: await bcrypt.hash(body.password, 12), role: "VIEWER" });
  return res.status(201).json({ success: true, data: { token: issueToken({ id: String(user._id), email: user.email, name: user.name, role: user.role }), user: dto(user) } });
}));
router.post("/login", asyncHandler(async (req, res) => {
  const body = credentials.parse(req.body);
  const user = await User.findOne({ email: body.email }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) return res.status(401).json({ success: false, message: "Email or password is incorrect" });
  return res.json({ success: true, data: { token: issueToken({ id: String(user._id), email: user.email, name: user.name, role: user.role }), user: dto(user) } });
}));
router.post("/logout", (_req, res) => res.json({ success: true, message: "Signed out. Remove the access token from the client." }));
router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.id);
  if (!user) return res.status(404).json({ success: false, message: "Account no longer exists" });
  return res.json({ success: true, data: dto(user) });
}));
export default router;
