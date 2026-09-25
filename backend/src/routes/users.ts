import { Router } from "express";
import { User } from "../models/User.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { z } from "zod";
const router = Router();
router.get("/", requireAuth, allowRoles("ADMIN"), asyncHandler(async (_req, res) => {
  const users = await User.find().select("name email role createdAt").sort({ createdAt: -1 }).limit(500).lean();
  return res.json({ success: true, data: users.map((user) => ({ id: String(user._id), name: user.name, email: user.email, role: user.role, createdAt: user.createdAt })) });
}));
router.patch("/:userId/role", requireAuth, allowRoles("ADMIN"), asyncHandler(async (req, res) => {
  const { role } = z.object({ role: z.enum(["ADMIN", "NODE_OPERATOR", "VIEWER"]) }).parse(req.body);
  if (req.params.userId === req.user!.id && role !== "ADMIN" && await User.countDocuments({ role: "ADMIN" }) <= 1) return res.status(409).json({ success: false, message: "The last administrator cannot be demoted" });
  const user = await User.findByIdAndUpdate(req.params.userId, { $set: { role } }, { new: true }).select("name email role");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  return res.json({ success: true, data: { id: String(user._id), name: user.name, email: user.email, role: user.role } });
}));
export default router;
