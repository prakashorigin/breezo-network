import type { SensorData } from "../types/sensor";
import axios from "axios";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:6001/api";
const http = axios.create({ baseURL: API_BASE, timeout: 10_000, headers: { "Content-Type": "application/json" } });
http.interceptors.request.use((config) => { const token = getToken(); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
http.interceptors.response.use((response) => response, (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message ?? error.message ?? "Network request failed";
    return Promise.reject(new Error(String(message)));
  }
  return Promise.reject(error);
});
export interface SessionUser { id: string; email: string; name: string; role: "ADMIN" | "NODE_OPERATOR" | "VIEWER" }
export interface ApiResult<T> { data: T; demo: boolean; error?: string }

export function getSession(): SessionUser | null {
  try { const raw = localStorage.getItem("breezo.session"); return raw ? JSON.parse(raw) as SessionUser : null; } catch { return null; }
}
export function getToken() { return localStorage.getItem("breezo.token"); }
export function logout() { localStorage.removeItem("breezo.token"); localStorage.removeItem("breezo.session"); }

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {};
  new Headers(init.headers).forEach((value, key) => { headers[key] = value; });
  const response = await http.request<{ data?: T } & T>({ url: path, method: init.method ?? "GET", data: init.body ? JSON.parse(String(init.body)) : undefined, headers, signal: init.signal ?? undefined });
  const payload = response.data as { data?: T };
  return (payload.data ?? response.data) as T;
}

export async function loadSensors(): Promise<ApiResult<SensorData[]>> {
  try {
    const result = await request<SensorData[] | { sensors: SensorData[] }>("/sensors");
    const sensors = Array.isArray(result) ? result : result.sensors;
    return { data: sensors, demo: false };
  } catch (error) { return { data: [], demo: false, error: error instanceof Error ? error.message : "API unavailable" }; }
}

export async function login(email: string, password: string, name?: string) {
  const result = await request<{ token: string; user: SessionUser }>(name ? "/auth/register" : "/auth/login", {
    method: "POST", body: JSON.stringify(name ? { name, email, password } : { email, password }),
  });
  localStorage.setItem("breezo.token", result.token);
  localStorage.setItem("breezo.session", JSON.stringify(result.user));
  return result.user;
}

export { API_BASE };
