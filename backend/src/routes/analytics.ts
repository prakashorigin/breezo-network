import { Router } from "express";
import { Sensor } from "../models/Sensor.js";
import { Telemetry } from "../models/Telemetry.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
const rangeMs: Record<string, number> = { "1h": 3_600_000, "6h": 21_600_000, "24h": 86_400_000, "7d": 604_800_000, "30d": 2_592_000_000, "1hour": 3_600_000, "6hours": 21_600_000, "24hours": 86_400_000, "7days": 604_800_000, "30days": 2_592_000_000 };
function sinceFor(range: unknown) { return new Date(Date.now() - (rangeMs[String(range ?? "24h").toLowerCase()] ?? rangeMs["24h"])); }
router.get("/network", asyncHandler(async (req, res) => {
  const since = sinceFor(req.query.range);
  const [aggregate, activeSensors, totalSensors, telemetryCount] = await Promise.all([
    Telemetry.aggregate([{ $match: { timestamp: { $gte: since } } }, { $group: { _id: null, averageAqi: { $avg: "$aqi" }, maximumAqi: { $max: "$aqi" }, minimumAqi: { $min: "$aqi" }, averagePm25: { $avg: "$pm25" }, averagePm10: { $avg: "$pm10" } } }]),
    Sensor.countDocuments({ status: { $in: ["online", "warning"] } }), Sensor.countDocuments(), Telemetry.countDocuments({ timestamp: { $gte: since } }),
  ]);
  const result = aggregate[0] ?? {};
  return res.json({ success: true, data: { averageAqi: Math.round(result.averageAqi ?? 0), maximumAqi: result.maximumAqi ?? 0, minimumAqi: result.minimumAqi ?? 0, averagePm25: Number((result.averagePm25 ?? 0).toFixed(1)), averagePm10: Number((result.averagePm10 ?? 0).toFixed(1)), activeSensors, offlineSensors: Math.max(0, totalSensors - activeSensors), telemetryCount } });
}));
router.get("/timeseries", asyncHandler(async (req, res) => {
  const since = sinceFor(req.query.range);
  const step = req.query.range === "1h" || req.query.range === "1hour" ? 60_000 : req.query.range === "6h" || req.query.range === "6hours" ? 5 * 60_000 : req.query.range === "24h" || req.query.range === "24hours" ? 30 * 60_000 : 6 * 60 * 60_000;
  const rows = await Telemetry.aggregate([
    { $match: { timestamp: { $gte: since } } },
    { $group: { _id: { $toDate: { $subtract: [{ $toLong: "$timestamp" }, { $mod: [{ $toLong: "$timestamp" }, step] }] } }, aqi: { $avg: "$aqi" }, pm25: { $avg: "$pm25" }, pm10: { $avg: "$pm10" }, temperature: { $avg: "$temperature" }, humidity: { $avg: "$humidity" } } },
    { $sort: { _id: 1 } }, { $limit: 1000 },
  ]);
  return res.json({ success: true, data: rows.map((row) => ({ timestamp: row._id, label: new Date(row._id).toLocaleString(), aqi: Math.round(row.aqi), pm25: Number(row.pm25.toFixed(1)), pm10: Number(row.pm10.toFixed(1)), temperature: Number(row.temperature.toFixed(1)), humidity: Math.round(row.humidity) })) });
}));
router.get("/sensors", asyncHandler(async (_req, res) => {
  const since = sinceFor(_req.query.range);
  const sensors = await Sensor.find().select("sensorId status lastSeen").lean();
  const result = await Promise.all(sensors.map(async (sensor) => {
    const filter = { sensorId: sensor.sensorId, timestamp: { $gte: since } };
    const [total, oldest] = await Promise.all([Telemetry.countDocuments(filter), Telemetry.findOne(filter).sort({ timestamp: 1 }).select("timestamp").lean()]);
    const elapsedMs = oldest ? Math.max(2000, Date.now() - Math.max(since.getTime(), oldest.timestamp.getTime())) : 0;
    const expected = Math.max(1, Math.ceil(elapsedMs / 2000));
    const uptime = oldest ? Math.min(100, Math.round((total / expected) * 100)) : 0;
    return { sensorId: sensor.sensorId, status: sensor.status, uptime, telemetryCount: total, firstSeen: oldest?.timestamp ?? null, lastSeen: sensor.lastSeen };
  }));
  return res.json({ success: true, data: result });
}));
export default router;
