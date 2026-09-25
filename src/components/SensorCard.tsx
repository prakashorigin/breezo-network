import { ArrowUpRight, MapPin, Radio } from "lucide-react";
import type { SensorData } from "../types/sensor";
export function SensorCard({ sensor, onOpen }: { sensor: SensorData; onOpen: (id: string) => void }) {
  const aqiTone = sensor.aqi < 51 ? "good" : sensor.aqi < 101 ? "moderate" : sensor.aqi < 151 ? "sensitive" : "danger";
  return <button className="sensor-row" onClick={() => onOpen(sensor.sensorId)}><span className={`sensor-health ${sensor.status}`}><Radio size={15} /></span><span className="sensor-row-main"><strong>{sensor.name ?? sensor.sensorId}</strong><small><MapPin size={11} /> {sensor.location ?? "Location not provided"}</small></span><span className="sensor-read"><strong className={`aqi-text ${aqiTone}`}>{sensor.status === "offline" ? "—" : sensor.aqi}</strong><small>AQI</small></span><span className={`status-label ${sensor.status}`}><i />{sensor.status}</span><ArrowUpRight className="sensor-arrow" size={15} /></button>;
}
