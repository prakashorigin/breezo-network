import { z } from "zod";
export const sensorCreateSchema = z.object({
  sensorId: z.string().trim().min(3).max(48).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase()),
  name: z.string().trim().max(100).optional().default(""),
  location: z.string().trim().min(2).max(160),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
}).refine((value) => (value.latitude === undefined) === (value.longitude === undefined), { message: "Latitude and longitude must be supplied together" });
export const sensorUpdateSchema = z.object({ name: z.string().trim().max(100).optional(), location: z.string().trim().min(2).max(160).optional(), latitude: z.number().min(-90).max(90).nullable().optional(), longitude: z.number().min(-180).max(180).nullable().optional(), status: z.literal("offline").optional() }).refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field to update" });
