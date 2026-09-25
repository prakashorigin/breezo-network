import assert from "node:assert/strict";
import test from "node:test";
import supertest from "supertest";
import { app } from "../src/app.js";

test("health remains available with MongoDB disconnected", async () => {
  const response = await supertest(app).get("/api/health").expect(200);
  assert.deepEqual(response.body, { success: true, message: "BREEZO API is running", services: { database: "disconnected" }, timestamp: response.body.timestamp });
});

test("sensor management requires an account token", async () => {
  const response = await supertest(app).post("/api/sensors").send({}).expect(401);
  assert.equal(response.body.message, "Authentication required");
});

test("API rejects plaintext or incomplete telemetry envelopes", async () => {
  const response = await supertest(app).post("/api/telemetry").send({ sensorId: "ESP32-001", pm25: 10 }).expect(400);
  assert.equal(response.body.message, "Request validation failed");
});
