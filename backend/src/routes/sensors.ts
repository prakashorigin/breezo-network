import { Router } from "express";
import { Sensor } from "../models/Sensor.js";
import { Telemetry } from "../models/Telemetry.js";
import { Reward } from "../models/Reward.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { sensorCreateSchema, sensorUpdateSchema } from "../validators/sensor.js";
import { encryptDeviceKey, hashDeviceKey, issueDeviceKey } from "../services/deviceCrypto.js";
import { emitEvent } from "../services/socketBus.js";

const router = Router();
function dto(sensor: any) {
  const owner = sensor.owner && typeof sensor.owner === "object" ? sensor.owner.name ?? sensor.owner.email : "";
  return { sensorId: sensor.sensorId, name: sensor.name, owner, location: sensor.location, latitude: sensor.latitude, longitude: sensor.longitude, status: sensor.status, aqi: sensor.aqi ?? 0, pm25: sensor.pm25 ?? 0, pm10: sensor.pm10 ?? 0, temperature: sensor.temperature ?? 0, humidity: sensor.humidity ?? 0, lastSeen: sensor.lastSeen, timestamp: sensor.lastSeen ?? sensor.updatedAt, isVerified: sensor.isVerified, blockchainAddress: sensor.blockchainAddress };
}
router.get("/", asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.status && ["online", "offline", "warning"].includes(String(req.query.status))) filter.status = String(req.query.status);
  if (req.user?.role === "NODE_OPERATOR") filter.owner = req.user.id;
  const sensors = await Sensor.find(filter).populate("owner", "name email").sort({ updatedAt: -1 }).lean();
  return res.json({ success: true, data: sensors.map(dto) });
}));
router.post("/", requireAuth, allowRoles("ADMIN", "NODE_OPERATOR"), asyncHandler(async (req, res) => {
  const input = sensorCreateSchema.parse(req.body);
  const deviceKey = issueDeviceKey();
  const sensor = await Sensor.create({ ...input, owner: req.user!.id, deviceKeyHash: hashDeviceKey(deviceKey), deviceKeyEncrypted: encryptDeviceKey(deviceKey), status: "offline" });
  emitEvent("sensor:updated", dto(sensor));
  return res.status(201).json({ success: true, data: { sensor: dto(sensor), deviceKey } });
}));
router.get("/:sensorId", asyncHandler(async (req, res) => {
  const sensor = await Sensor.findOne({ sensorId: req.params.sensorId.toUpperCase() }).populate("owner", "name email").lean();
  if (!sensor) return res.status(404).json({ success: false, message: "Sensor not found" });
  return res.json({ success: true, data: dto(sensor) });
}));
router.patch("/:sensorId", requireAuth, allowRoles("ADMIN", "NODE_OPERATOR"), asyncHandler(async (req, res) => {
  const input = sensorUpdateSchema.parse(req.body);
  const filter: Record<string, unknown> = { sensorId: req.params.sensorId.toUpperCase() };
  if (req.user!.role !== "ADMIN") filter.owner = req.user!.id;
  const sensor = await Sensor.findOneAndUpdate(filter, { $set: input }, { new: true, runValidators: true }).populate("owner", "name email");
  if (!sensor) return res.status(404).json({ success: false, message: "Sensor not found or access denied" });
  emitEvent("sensor:updated", dto(sensor));
  return res.json({ success: true, data: dto(sensor) });
}));
router.delete("/:sensorId", requireAuth, allowRoles("ADMIN", "NODE_OPERATOR"), asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = { sensorId: req.params.sensorId.toUpperCase() };
  if (req.user!.role !== "ADMIN") filter.owner = req.user!.id;
  const sensor = await Sensor.findOneAndDelete(filter);
  if (!sensor) return res.status(404).json({ success: false, message: "Sensor not found or access denied" });
  await Promise.all([Telemetry.deleteMany({ sensorId: sensor.sensorId }), Reward.deleteMany({ sensorId: sensor.sensorId })]);
  emitEvent("sensor:updated", { sensorId: sensor.sensorId, removed: true });
  return res.json({ success: true, message: "Sensor and its stored telemetry have been removed" });
}));
router.post("/:sensorId/verify", requireAuth, allowRoles("ADMIN"), asyncHandler(async (req, res) => {
  const sensor = await Sensor.findOneAndUpdate({ sensorId: req.params.sensorId.toUpperCase() }, { $set: { isVerified: true } }, { new: true }).populate("owner", "name email");
  if (!sensor) return res.status(404).json({ success: false, message: "Sensor not found" });
  emitEvent("sensor:updated", dto(sensor));
  return res.json({ success: true, data: dto(sensor) });
}));
router.post("/:sensorId/rotate-key", requireAuth, allowRoles("ADMIN", "NODE_OPERATOR"), asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = { sensorId: req.params.sensorId.toUpperCase() };
  if (req.user!.role !== "ADMIN") filter.owner = req.user!.id;
  const deviceKey = issueDeviceKey();
  const sensor = await Sensor.findOneAndUpdate(filter, { $set: { deviceKeyHash: hashDeviceKey(deviceKey), deviceKeyEncrypted: encryptDeviceKey(deviceKey), lastSequence: -1 } }, { new: true });
  if (!sensor) return res.status(404).json({ success: false, message: "Sensor not found or access denied" });
  await import("../models/ReplayNonce.js").then(({ ReplayNonce }) => ReplayNonce.deleteMany({ sensorId: sensor.sensorId }));
  return res.json({ success: true, data: { sensor: dto(sensor), deviceKey } });
}));
export default router;
