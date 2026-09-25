import { z } from "zod";

export const telemetryEnvelopeSchema = z.object({
  sensorId: z.string().trim().min(3).max(48).transform((value) => value.toUpperCase()),
  sequenceNumber: z.number().int().nonnegative(),
  timestamp: z.string().datetime({ offset: true }),
  encrypted: z.object({
    iv: z.string().regex(/^[A-Za-z0-9_-]{16}$/),
    tag: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
    ciphertext: z.string().min(8).max(4096).regex(/^[A-Za-z0-9_-]+$/),
  }).strict(),
}).strict();

export const telemetryPayloadSchema = z.object({
  pm25: z.number().min(0).max(1000),
  pm10: z.number().min(0).max(1000),
  temperature: z.number().min(-40).max(85),
  humidity: z.number().min(0).max(100),
}).strict();
