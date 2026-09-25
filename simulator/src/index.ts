import "dotenv/config";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { makeNode, nextReading, makeNonce, signReading, encryptReading, type SimulatedNode } from "./sensorSimulator.js";

const apiBase = (process.env.SIMULATOR_API_URL ?? "http://localhost:6001/api").replace(/\/$/, "");
const countArg = process.argv.find((value) => value.startsWith("--sensors="));
const sensorCount = Math.max(1, Math.min(100, Number(countArg?.split("=")[1] ?? 1) || 1));
const credentials = new Map((process.env.SIMULATOR_DEVICE_KEYS ?? "").split(",").map((pair) => pair.trim()).filter(Boolean).map((pair) => { const separator = pair.indexOf("="); return [pair.slice(0, separator).trim().toUpperCase(), pair.slice(separator + 1).trim()] as const; }));
const token = process.env.SIMULATOR_JWT;

async function registerNode(sensorId: string, index: number) {
  if (!token) return undefined;
  const [latitude, longitude] = [[27.7152, 85.3123], [27.6648, 85.3188], [27.6784, 85.3473], [27.7215, 85.3620]][index % 4];
  const response = await fetch(`${apiBase}/sensors`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ sensorId, name: `Simulator node ${sensorId.slice(-3)}`, location: "Kathmandu Valley · simulator", latitude, longitude }) });
  const payload = await response.json() as { data?: { deviceKey?: string }; message?: string };
  if (!response.ok) { console.error(`${sensorId}: registration failed: ${payload.message ?? response.statusText}`); return undefined; }
  const deviceKey = payload.data?.deviceKey;
  if (deviceKey) await persistDeviceKey(sensorId, deviceKey);
  console.warn(`${sensorId}: registered. Its one-time device key was saved to simulator/.env (gitignored).`);
  return deviceKey;
}

async function persistDeviceKey(sensorId: string, deviceKey: string) {
  const envPath = resolve(process.cwd(), ".env");
  const current = await readFile(envPath, "utf8").catch(() => "");
  const existing = new Map((current.match(/^SIMULATOR_DEVICE_KEYS=.*$/m)?.[0].slice("SIMULATOR_DEVICE_KEYS=".length) ?? process.env.SIMULATOR_DEVICE_KEYS ?? "").split(",").map((pair) => pair.trim()).filter(Boolean).map((pair) => {
    const separator = pair.indexOf("="); return [pair.slice(0, separator).trim().toUpperCase(), pair.slice(separator + 1).trim()] as const;
  }));
  existing.set(sensorId, deviceKey);
  const setting = `SIMULATOR_DEVICE_KEYS=${[...existing].map(([id, key]) => `${id}=${key}`).join(",")}`;
  const lines = current.split(/\r?\n/).filter((line) => !line.startsWith("SIMULATOR_DEVICE_KEYS="));
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  lines.push(setting, "");
  await writeFile(envPath, lines.join("\n"), { mode: 0o600 });
  await chmod(envPath, 0o600);
}

async function start() {
  const nodes: SimulatedNode[] = [];
  for (let index = 0; index < sensorCount; index += 1) {
    const sensorId = `ESP32-${String(index + 1).padStart(3, "0")}`;
    let key = credentials.get(sensorId);
    if (!key) key = await registerNode(sensorId, index);
    if (key) nodes.push(makeNode(index, key));
  }
  if (!nodes.length) {
    console.error("No device keys available. Register nodes in the dashboard and save their one-time keys, then set SIMULATOR_DEVICE_KEYS=ESP32-001=<key> in simulator/.env. For auto-registration set SIMULATOR_JWT to an ADMIN or NODE_OPERATOR access token.");
    process.exitCode = 1;
    return;
  }
  console.log(`BREEZO sensor simulator · ${nodes.length} node(s) · ${apiBase} · reporting every 2 seconds`);
  let sending = false;
  const report = async () => {
    if (sending) return;
    sending = true;
    await Promise.all(nodes.map(async (node) => {
      const reading = nextReading(node);
      const timestamp = String(Date.now()); const sequence = String(reading.sequenceNumber); const nonce = makeNonce();
      const envelope = { sensorId: reading.sensorId, sequenceNumber: reading.sequenceNumber, timestamp: reading.timestamp, encrypted: encryptReading(node.deviceKey, reading) };
      const signature = signReading(node.deviceKey, timestamp, sequence, nonce, envelope);
      try {
        const response = await fetch(`${apiBase}/telemetry`, { method: "POST", headers: { "content-type": "application/json", "x-sensor-timestamp": timestamp, "x-sensor-sequence": sequence, "x-sensor-nonce": nonce, "x-sensor-signature": signature }, body: JSON.stringify(envelope) });
        const payload = await response.json() as { data?: { aqi?: number }; message?: string };
        if (!response.ok) console.error(`${node.sensorId}: rejected (${response.status}) ${payload.message ?? "request failed"}`);
        else console.log(`${node.sensorId} → AQI ${payload.data?.aqi ?? "—"} · PM2.5 ${reading.pm25.toFixed(1)} · PM10 ${reading.pm10.toFixed(1)} · ${reading.temperature.toFixed(1)}°C · ${reading.humidity}%`);
      } catch (error) { console.error(`${node.sensorId}: API unavailable · ${error instanceof Error ? error.message : "network error"}`); }
    }));
    sending = false;
  };
  await report();
  const timer = setInterval(() => void report(), 2000);
  const stop = () => { clearInterval(timer); console.log("Simulator stopped."); process.exit(0); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
}
void start();
