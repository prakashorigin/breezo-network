import { createServer } from "node:http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { app } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { setSocketServer, emitEvent } from "./services/socketBus.js";
import { Sensor } from "./models/Sensor.js";

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: env.CLIENT_URL.split(",").map((value) => value.trim()), methods: ["GET", "POST"] }, maxHttpBufferSize: 32_768 });
setSocketServer(io);
io.on("connection", (socket) => {
  socket.emit("network:stats", { connectedClients: io.engine.clientsCount, database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

mongoose.connection.on("connected", () => emitEvent("network:stats", { database: "connected" }));
mongoose.connection.on("disconnected", () => emitEvent("network:stats", { database: "disconnected" }));
const staleCheck = setInterval(() => {
  if (mongoose.connection.readyState !== 1) return;
  void (async () => {
    const cutoff = new Date(Date.now() - 15_000);
    const stale = await Sensor.find({ status: { $in: ["online", "warning"] }, lastSeen: { $lt: cutoff } }).select("sensorId lastSeen").lean();
    if (!stale.length) return;
    await Sensor.updateMany({ sensorId: { $in: stale.map((sensor) => sensor.sensorId) } }, { $set: { status: "offline" } });
    for (const sensor of stale) emitEvent("sensor:disconnected", { sensorId: sensor.sensorId, lastSeen: sensor.lastSeen, status: "offline" });
    const onlineSensors = await Sensor.countDocuments({ status: { $in: ["online", "warning"] } });
    emitEvent("network:stats", { onlineSensors, totalSensors: await Sensor.countDocuments() });
  })().catch((error) => console.error("Offline sensor sweep failed", error));
}, 5000);
staleCheck.unref();

httpServer.listen(env.PORT, () => {
  console.log(`BREEZO API listening on http://localhost:${env.PORT}`);
  void connectDatabase().then(() => console.log("MongoDB connected")).catch((error: unknown) => console.error("MongoDB is not connected; health endpoint remains available", error));
});

async function shutdown() {
  clearInterval(staleCheck);
  io.close();
  await mongoose.disconnect();
  httpServer.close(() => process.exit(0));
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
