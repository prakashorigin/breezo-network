import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type Role = "ADMIN" | "NODE_OPERATOR" | "VIEWER";
export interface AuthUser { id: string; email: string; role: Role; name: string }
declare global { namespace Express { interface Request { user?: AuthUser } } }

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) return res.status(401).json({ success: false, message: "Authentication required" });
  try {
    const decoded = jwt.verify(authorization.slice(7), env.JWT_SECRET) as jwt.JwtPayload;
    if (typeof decoded.sub !== "string" || !decoded.role || !decoded.email || !decoded.name) return res.status(401).json({ success: false, message: "Invalid access token" });
    req.user = { id: decoded.sub, role: decoded.role as Role, email: decoded.email as string, name: decoded.name as string };
    next();
  } catch { return res.status(401).json({ success: false, message: "Invalid or expired access token" }); }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.header("authorization")) return next();
  return requireAuth(req, res, next);
}

export function allowRoles(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ success: false, message: "You do not have permission to perform this action" });
    next();
  };
}
