import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(6001),
  MONGO_URI: z.string().default("mongodb://127.0.0.1:27017/breezo_network"),
  JWT_SECRET: z.string().min(32).default("development-only-change-this-secret-32-chars"),
  JWT_EXPIRES_IN: z.string().default("12h"),
  CLIENT_URL: z.string().default("http://localhost:4001"),
  SENSOR_ENCRYPTION_KEY: z.string().min(32).default("development-encryption-key-change-this"),
  SENSOR_CLOCK_TOLERANCE_SECONDS: z.coerce.number().int().positive().default(30),
  SOLANA_RPC_URL: z.string().default("https://api.devnet.solana.com"),
  SOLANA_PROGRAM_ID: z.string().default(""),
  SOLANA_REWARD_MINT: z.string().default(""),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).optional(),
});

export const env = envSchema.parse(process.env);
if (env.NODE_ENV === "production" && /development|local-compose|change-this|replace-with/i.test(`${env.JWT_SECRET} ${env.SENSOR_ENCRYPTION_KEY}`)) {
  throw new Error("Set unique production JWT_SECRET and SENSOR_ENCRYPTION_KEY values before starting the API");
}
