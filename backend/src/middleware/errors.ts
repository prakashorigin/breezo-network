import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";

export const notFound: RequestHandler = (req, res) => res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} was not found` });
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) return res.status(400).json({ success: false, message: "Request validation failed", errors: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) });
  if (error instanceof mongoose.Error.ValidationError) return res.status(400).json({ success: false, message: "Database validation failed" });
  if (error instanceof mongoose.Error.CastError) return res.status(400).json({ success: false, message: "Invalid identifier" });
  if (error && typeof error === "object" && "code" in error && error.code === 11000) return res.status(409).json({ success: false, message: "A record with those details already exists" });
  if (process.env.NODE_ENV !== "test") console.error("API request failed", error);
  return res.status(500).json({ success: false, message: "An unexpected server error occurred" });
};
