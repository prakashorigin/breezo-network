import { Schema, model, type InferSchemaType } from "mongoose";

const rewardSchema = new Schema({
  sensorId: { type: String, required: true, index: true },
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["pending", "claimed"], default: "pending", index: true },
  txSignature: { type: String, default: "" },
  periodStart: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

rewardSchema.index({ sensorId: 1, periodStart: 1 }, { unique: true });
export type RewardDocument = InferSchemaType<typeof rewardSchema>;
export const Reward = model("Reward", rewardSchema);
