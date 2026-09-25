import { Schema, model, type InferSchemaType } from "mongoose";

const telemetrySchema = new Schema({
  sensorId: { type: String, required: true, index: true },
  aqi: { type: Number, required: true, min: 0, max: 500 },
  pm25: { type: Number, required: true, min: 0, max: 1000 },
  pm10: { type: Number, required: true, min: 0, max: 1000 },
  temperature: { type: Number, required: true, min: -40, max: 85 },
  humidity: { type: Number, required: true, min: 0, max: 100 },
  timestamp: { type: Date, required: true, index: true },
  sequenceNumber: { type: Number, required: true },
}, { timestamps: true, versionKey: false });

telemetrySchema.index({ sensorId: 1, timestamp: -1 });
telemetrySchema.index({ timestamp: -1 });
telemetrySchema.index({ sensorId: 1, sequenceNumber: 1 }, { unique: true });
export type TelemetryDocument = InferSchemaType<typeof telemetrySchema>;
export const Telemetry = model("Telemetry", telemetrySchema);
