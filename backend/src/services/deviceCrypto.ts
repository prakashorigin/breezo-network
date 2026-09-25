import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { stableJson } from "../utils/stableJson.js";

const key = () => createHash("sha256").update(env.SENSOR_ENCRYPTION_KEY).digest();
export function issueDeviceKey() { return randomBytes(32).toString("base64url"); }
export function hashDeviceKey(secret: string) { return createHash("sha256").update(secret).digest("hex"); }
export function encryptDeviceKey(secret: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
export function decryptDeviceKey(value: string) {
  const [ivText, tagText, encryptedText] = value.split(".");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}
export function telemetrySignature(secret: string, timestamp: string, sequence: string, nonce: string, payload: unknown) {
  return createHmac("sha256", secret).update(`${timestamp}.${sequence}.${nonce}.${stableJson(payload)}`).digest("hex");
}
export interface EncryptedReading { iv: string; tag: string; ciphertext: string }
export function encryptTelemetryPayload(secret: string, sensorId: string, sequence: number, timestamp: string, payload: unknown): EncryptedReading {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(secret).digest(), iv);
  cipher.setAAD(Buffer.from(`${sensorId}.${sequence}.${timestamp}`));
  const ciphertext = Buffer.concat([cipher.update(stableJson(payload), "utf8"), cipher.final()]);
  return { iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), ciphertext: ciphertext.toString("base64url") };
}
export function decryptTelemetryPayload(secret: string, sensorId: string, sequence: number, timestamp: string, encrypted: EncryptedReading) {
  const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(secret).digest(), Buffer.from(encrypted.iv, "base64url"));
  decipher.setAAD(Buffer.from(`${sensorId}.${sequence}.${timestamp}`));
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, "base64url")), decipher.final()]).toString("utf8");
  return JSON.parse(plaintext) as unknown;
}
export function safeSignatureEqual(expected: string, provided: string) {
  const expectedBuffer = Buffer.from(expected, "hex"); const providedBuffer = Buffer.from(provided, "hex");
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}
