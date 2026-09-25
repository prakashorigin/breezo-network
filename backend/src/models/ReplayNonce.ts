import { Schema, model } from "mongoose";

const replayNonceSchema = new Schema({
  sensorId: { type: String, required: true },
  nonce: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 3600 },
}, { versionKey: false });
replayNonceSchema.index({ sensorId: 1, nonce: 1 }, { unique: true });
export const ReplayNonce = model("ReplayNonce", replayNonceSchema);
