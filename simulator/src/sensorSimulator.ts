import { createCipheriv, createHash, createHmac, randomBytes } from "node:crypto";

export interface SensorReading { sensorId: string; sequenceNumber: number; timestamp: string; pm25: number; pm10: number; temperature: number; humidity: number }
export interface SimulatedNode { sensorId: string; deviceKey: string; sequence: number; phase: number; pm25: number; pm10: number; temperature: number; humidity: number; latitude: number; longitude: number }
const locations = [[27.7152, 85.3123], [27.6648, 85.3188], [27.6784, 85.3473], [27.7215, 85.3620], [27.7007, 85.3074], [27.7333, 85.3240], [27.6821, 85.3052], [27.6936, 85.2814], [27.7098, 85.3442], [27.6507, 85.3245]];

export function makeNode(index: number, deviceKey: string): SimulatedNode {
  const [latitude, longitude] = locations[index % locations.length];
  return { sensorId: `ESP32-${String(index + 1).padStart(3, "0")}`, deviceKey, sequence: Math.floor(Date.now() / 1000) * 1000, phase: Math.random() * Math.PI * 2, pm25: 18 + Math.random() * 10, pm10: 30 + Math.random() * 15, temperature: 23 + Math.random() * 5, humidity: 48 + Math.random() * 20, latitude, longitude };
}

export function nextReading(node: SimulatedNode, now = new Date()): SensorReading {
  const drift = () => (Math.random() - 0.5) * 1.8;
  const cycle = Math.sin((Date.now() / 1000 / 60) + node.phase) * 3;
  node.pm25 = Math.max(1, Math.min(180, node.pm25 + drift() + cycle * 0.05));
  node.pm10 = Math.max(node.pm25 * 1.25, Math.min(300, node.pm10 + drift() * 1.6 + cycle * 0.08));
  node.temperature = Math.max(4, Math.min(42, node.temperature + drift() * 0.16));
  node.humidity = Math.max(15, Math.min(95, node.humidity + drift() * 0.3));
  node.sequence += 1;
  return { sensorId: node.sensorId, sequenceNumber: node.sequence, timestamp: now.toISOString(), pm25: Math.round(node.pm25 * 10) / 10, pm10: Math.round(node.pm10 * 10) / 10, temperature: Math.round(node.temperature * 10) / 10, humidity: Math.round(node.humidity) };
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
export function encryptReading(deviceKey: string, reading: SensorReading) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(deviceKey).digest(), iv);
  cipher.setAAD(Buffer.from(`${reading.sensorId}.${reading.sequenceNumber}.${reading.timestamp}`));
  const plaintext = { pm25: reading.pm25, pm10: reading.pm10, temperature: reading.temperature, humidity: reading.humidity };
  const ciphertext = Buffer.concat([cipher.update(canonicalJson(plaintext), "utf8"), cipher.final()]);
  return { iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), ciphertext: ciphertext.toString("base64url") };
}
export function signReading(deviceKey: string, timestamp: string, sequence: string, nonce: string, payload: unknown) {
  return createHmac("sha256", deviceKey).update(`${timestamp}.${sequence}.${nonce}.${canonicalJson(payload)}`).digest("hex");
}
export function makeNonce() { return randomBytes(18).toString("base64url"); }
