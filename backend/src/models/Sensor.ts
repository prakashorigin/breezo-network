import { Schema, model, type InferSchemaType } from "mongoose";

const sensorSchema = new Schema({
  sensorId: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 48, index: true },
  name: { type: String, trim: true, maxlength: 100, default: "" },
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  location: { type: String, required: true, trim: true, maxlength: 160 },
  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 },
  status: { type: String, enum: ["online", "offline", "warning"], default: "offline", index: true },
  aqi: { type: Number, min: 0, max: 500, default: 0 },
  pm25: { type: Number, min: 0, max: 1000, default: 0 },
  pm10: { type: Number, min: 0, max: 1000, default: 0 },
  temperature: { type: Number, min: -40, max: 85, default: 0 },
  humidity: { type: Number, min: 0, max: 100, default: 0 },
  lastSeen: { type: Date, default: null, index: true },
  isVerified: { type: Boolean, default: false },
  blockchainAddress: { type: String, default: "" },
  deviceKeyHash: { type: String, required: true, select: false },
  deviceKeyEncrypted: { type: String, required: true, select: false },
  lastSequence: { type: Number, default: -1 },
}, { timestamps: true, versionKey: false });

sensorSchema.index({ latitude: 1, longitude: 1 });
export type SensorDocument = InferSchemaType<typeof sensorSchema>;
export const Sensor = model("Sensor", sensorSchema);
