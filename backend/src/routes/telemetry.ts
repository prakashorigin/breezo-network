import { Router } from "express";
import { env } from "../config/env.js";
import { Sensor } from "../models/Sensor.js";
import { Telemetry } from "../models/Telemetry.js";
import { ReplayNonce } from "../models/ReplayNonce.js";
import { Reward } from "../models/Reward.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { decryptDeviceKey, decryptTelemetryPayload, hashDeviceKey, safeSignatureEqual, telemetrySignature } from "../services/deviceCrypto.js";
import { calculateAqi } from "../utils/aqiCalculator.js";
import { telemetryEnvelopeSchema, telemetryPayloadSchema } from "../validators/telemetry.js";
import { emitEvent } from "../services/socketBus.js";
import { isTimestampFresh, shouldIssueContributionReward } from "../utils/securityPolicy.js";

const router = Router();
router.post("/", asyncHandler(async (req, res) => {
  const envelope = telemetryEnvelopeSchema.parse(req.body);
  const timestampHeader = req.header("x-sensor-timestamp") ?? "";
  const sequenceHeader = req.header("x-sensor-sequence") ?? "";
  const nonce = req.header("x-sensor-nonce") ?? "";
  const signature = req.header("x-sensor-signature") ?? "";
  const timestampMs = Number(timestampHeader); const sequence = Number(sequenceHeader);
  if (!isTimestampFresh(timestampMs, Date.now(), env.SENSOR_CLOCK_TOLERANCE_SECONDS * 1000) || !Number.isSafeInteger(sequence) || sequence !== envelope.sequenceNumber || !/^[A-Za-z0-9_-]{16,96}$/.test(nonce) || !/^[a-f0-9]{64}$/i.test(signature)) return res.status(401).json({ success: false, message: "Device authentication headers are missing or invalid" });
  const now = Date.now();
  if (!isTimestampFresh(new Date(envelope.timestamp).getTime(), now, env.SENSOR_CLOCK_TOLERANCE_SECONDS * 1000)) return res.status(401).json({ success: false, message: "Telemetry timestamp is outside the allowed clock window" });
  const sensor = await Sensor.findOne({ sensorId: envelope.sensorId }).select("+deviceKeyEncrypted +deviceKeyHash");
  if (!sensor) return res.status(401).json({ success: false, message: "This sensor is not registered" });
  const secret = decryptDeviceKey(sensor.deviceKeyEncrypted);
  if (hashDeviceKey(secret) !== sensor.deviceKeyHash) return res.status(401).json({ success: false, message: "Provisioned device key integrity check failed" });
  const expected = telemetrySignature(secret, timestampHeader, sequenceHeader, nonce, req.body);
  if (!safeSignatureEqual(expected, signature)) return res.status(401).json({ success: false, message: "Device signature verification failed" });
  let input: ReturnType<typeof telemetryPayloadSchema.parse>;
  try { input = telemetryPayloadSchema.parse(decryptTelemetryPayload(secret, envelope.sensorId, envelope.sequenceNumber, envelope.timestamp, envelope.encrypted)); }
  catch { return res.status(400).json({ success: false, message: "Encrypted telemetry could not be decrypted or failed payload validation" }); }
  try { await ReplayNonce.create({ sensorId: sensor.sensorId, nonce }); }
  catch (error) { if (error && typeof error === "object" && "code" in error && error.code === 11000) return res.status(409).json({ success: false, message: "Nonce has already been used" }); throw error; }
  const updated = await Sensor.findOneAndUpdate({ _id: sensor._id, lastSequence: { $lt: sequence } }, { $set: { lastSequence: sequence } }, { new: true });
  if (!updated) return res.status(409).json({ success: false, message: "Sequence number must be greater than the last accepted sequence" });

  const aqi = calculateAqi(input.pm25, input.pm10);
  const timestamp = new Date(envelope.timestamp);
  const telemetry = await Telemetry.create({ sensorId: sensor.sensorId, aqi, pm25: input.pm25, pm10: input.pm10, temperature: input.temperature, humidity: input.humidity, timestamp, sequenceNumber: sequence });
  const previousStatus = sensor.status;
  const status = aqi > 100 ? "warning" : "online";
  const current = await Sensor.findByIdAndUpdate(sensor._id, { $set: { status, lastSeen: timestamp, aqi, pm25: input.pm25, pm10: input.pm10, temperature: input.temperature, humidity: input.humidity } }, { new: true }).populate("owner", "name email");
  const reading = { sensorId: telemetry.sensorId, aqi: telemetry.aqi, pm25: telemetry.pm25, pm10: telemetry.pm10, temperature: telemetry.temperature, humidity: telemetry.humidity, status, timestamp: timestamp.toISOString(), latitude: current?.latitude, longitude: current?.longitude };
  if (previousStatus === "offline") emitEvent("sensor:connected", reading);
  emitEvent("sensor:telemetry", reading);
  if (status === "warning") emitEvent("sensor:warning", { ...reading, message: "AQI exceeds the moderate range" });
  const count = await Telemetry.countDocuments({ sensorId: sensor.sensorId });
  if (shouldIssueContributionReward(count) && current) {
    try {
      const reward = await Reward.create({ sensorId: sensor.sensorId, owner: current.owner, amount: 0.05, status: "pending", periodStart: timestamp });
      emitEvent("reward:updated", { sensorId: sensor.sensorId, amount: reward.amount, status: reward.status, recorded: false });
    } catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error; }
  }
  const onlineCount = await Sensor.countDocuments({ status: { $in: ["online", "warning"] } });
  const totalCount = await Sensor.countDocuments();
  emitEvent("network:stats", { onlineSensors: onlineCount, totalSensors: totalCount });
  return res.status(201).json({ success: true, data: reading });
}));

router.get("/:sensorId", asyncHandler(async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  const since = req.query.since ? new Date(String(req.query.since)) : undefined;
  const filter: Record<string, unknown> = { sensorId: req.params.sensorId.toUpperCase() };
  if (since && !Number.isNaN(since.getTime())) filter.timestamp = { $gte: since };
  const values = await Telemetry.find(filter).sort({ timestamp: -1 }).limit(limit).lean();
  return res.json({ success: true, data: values.reverse() });
}));
export default router;
