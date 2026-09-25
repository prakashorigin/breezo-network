import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { Reward } from "../models/Reward.js";
const router = Router();
router.get("/", asyncHandler(async (req, res) => {
  const filter = req.user?.role === "ADMIN" ? {} : req.user ? { owner: req.user.id } : { status: "claimed" };
  const rewards = await Reward.find(filter).sort({ createdAt: -1 }).limit(500).lean();
  return res.json({ success: true, data: rewards });
}));
router.get("/:sensorId", asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = { sensorId: req.params.sensorId.toUpperCase() };
  if (req.user?.role === "NODE_OPERATOR") filter.owner = req.user.id;
  else if (req.user?.role !== "ADMIN") filter.status = "claimed";
  const rewards = await Reward.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  return res.json({ success: true, data: rewards });
}));
router.post("/claim", requireAuth, (_req, res) => res.status(501).json({ success: false, message: "Reward claims are disabled until the Anchor program, treasury, and SPL reward mint are deployed and configured" }));
export default router;
