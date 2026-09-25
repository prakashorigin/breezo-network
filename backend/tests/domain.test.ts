import assert from "node:assert/strict";
import test from "node:test";
import { calculateAqi, classifyAqi } from "../src/utils/aqiCalculator.js";
import { decryptTelemetryPayload, encryptTelemetryPayload, safeSignatureEqual, telemetrySignature } from "../src/services/deviceCrypto.js";
import { isSequenceAcceptable, isTimestampFresh, shouldIssueContributionReward } from "../src/utils/securityPolicy.js";
import { telemetryEnvelopeSchema, telemetryPayloadSchema } from "../src/validators/telemetry.js";
import { encryptReading, signReading, type SensorReading } from "../../simulator/src/sensorSimulator.js";

test("AQI calculation maps clean particulate readings into the good band", () => {
  assert.ok(calculateAqi(5, 20) <= 50);
  assert.ok(calculateAqi(10, 220) > 100);
});

test("AQI classification covers the standard health bands", () => {
  assert.equal(classifyAqi(34), "Good");
  assert.equal(classifyAqi(82), "Moderate");
  assert.equal(classifyAqi(138), "Unhealthy for Sensitive Groups");
  assert.equal(classifyAqi(301), "Hazardous");
});

test("HMAC authenticates a canonical telemetry envelope", () => {
  const payload = { sensorId: "ESP32-001", sequenceNumber: 1, timestamp: "2026-01-01T00:00:00.000Z", encrypted: { iv: "MDEyMzQ1Njc4OWFi", tag: "MDEyMzQ1Njc4OWFiY2RlZg", ciphertext: "YWJjZGVmZ2hpamts" } };
  const signature = telemetrySignature("device-secret", "1000", "1", "abcdefghijklmnop", payload);
  assert.equal(safeSignatureEqual(signature, signature), true);
  assert.equal(safeSignatureEqual(telemetrySignature("device-secret", "1000", "1", "abcdefghijklmnop", { ...payload, sequenceNumber: 2 }), signature), false);
});

test("AES-GCM encrypts readings and binds them to sensor identity", () => {
  const timestamp = "2026-01-01T00:00:00.000Z";
  const values = { pm25: 10.2, pm10: 20, temperature: 24, humidity: 55 };
  const encrypted = encryptTelemetryPayload("device-secret", "ESP32-001", 1, timestamp, values);
  assert.deepEqual(decryptTelemetryPayload("device-secret", "ESP32-001", 1, timestamp, encrypted), values);
  assert.throws(() => decryptTelemetryPayload("device-secret", "ESP32-002", 1, timestamp, encrypted));
});

test("simulator encryption and signatures match the backend wire format", () => {
  const key = "same-device-secret";
  const reading: SensorReading = { sensorId: "ESP32-001", sequenceNumber: 8, timestamp: "2026-01-01T00:00:00.000Z", pm25: 10.2, pm10: 20, temperature: 24, humidity: 55 };
  const envelope = { sensorId: reading.sensorId, sequenceNumber: reading.sequenceNumber, timestamp: reading.timestamp, encrypted: encryptReading(key, reading) };
  const decrypted = decryptTelemetryPayload(key, reading.sensorId, reading.sequenceNumber, reading.timestamp, envelope.encrypted);
  assert.deepEqual(decrypted, { pm25: 10.2, pm10: 20, temperature: 24, humidity: 55 });
  const signature = signReading(key, "1000", "8", "abcdefghijklmnop", envelope);
  assert.equal(safeSignatureEqual(telemetrySignature(key, "1000", "8", "abcdefghijklmnop", envelope), signature), true);
});

test("replay policy accepts fresh timestamps and increasing sequence numbers only", () => {
  assert.equal(isTimestampFresh(10_000, 11_000, 2_000), true);
  assert.equal(isTimestampFresh(1_000, 11_000, 2_000), false);
  assert.equal(isSequenceAcceptable(20, 21), true);
  assert.equal(isSequenceAcceptable(20, 20), false);
  assert.equal(isSequenceAcceptable(20, 19), false);
});

test("reward policy only awards validated contribution milestones", () => {
  assert.equal(shouldIssueContributionReward(49), false);
  assert.equal(shouldIssueContributionReward(50), true);
  assert.equal(shouldIssueContributionReward(51), false);
});

test("telemetry envelope rejects plaintext and validates decrypted reading ranges", () => {
  const envelope = { sensorId: "ESP32-001", sequenceNumber: 1, timestamp: "2026-01-01T00:00:00.000Z", encrypted: { iv: "MDEyMzQ1Njc4OWFi", tag: "MDEyMzQ1Njc4OWFiY2RlZg", ciphertext: "YWJjZGVmZ2hpamts" } };
  assert.equal(telemetryEnvelopeSchema.safeParse(envelope).success, true);
  assert.equal(telemetryEnvelopeSchema.safeParse({ ...envelope, pm25: 12 }).success, false);
  assert.equal(telemetryPayloadSchema.safeParse({ pm25: 10, pm10: 15, temperature: 24, humidity: 55 }).success, true);
  assert.equal(telemetryPayloadSchema.safeParse({ pm25: -1, pm10: 15, temperature: 24, humidity: 101 }).success, false);
});
