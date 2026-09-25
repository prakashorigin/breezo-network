import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { SensorData } from "../types/sensor";
export function SensorMap({ sensors, onOpen, compact = false }: { sensors: SensorData[]; onOpen?: (id: string) => void; compact?: boolean }) {
  const located = sensors.filter((sensor) => Number.isFinite(sensor.latitude) && Number.isFinite(sensor.longitude));
  const center: [number, number] = located.length ? [located[0].latitude!, located[0].longitude!] : [27.7172, 85.3240];
  const markerColor = (sensor: SensorData) => sensor.status === "offline" ? "#68716f" : sensor.aqi <= 50 ? "#69d6a5" : sensor.aqi <= 100 ? "#e8cc69" : sensor.aqi <= 150 ? "#ed9b60" : "#e35f67";
  return <div className={`map-frame ${compact ? "compact" : ""}`}><MapContainer center={center} zoom={compact ? 11 : 12} scrollWheelZoom={!compact} className="leaflet-map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{located.map((sensor) => <CircleMarker key={sensor.sensorId} center={[sensor.latitude!, sensor.longitude!]} radius={compact ? 7 : 9} pathOptions={{ color: markerColor(sensor), fillColor: markerColor(sensor), fillOpacity: 0.9, weight: 2 }} eventHandlers={{ click: () => onOpen?.(sensor.sensorId) }}><Popup><div className="map-popup"><strong>{sensor.name ?? sensor.sensorId}</strong><span>{sensor.sensorId} · AQI {sensor.status === "offline" ? "—" : sensor.aqi}</span><small>{sensor.location}</small>{onOpen && <button onClick={() => onOpen(sensor.sensorId)}>Open sensor</button>}</div></Popup></CircleMarker>)}</MapContainer>{!located.length && <div className="map-empty">No sensor coordinates available yet</div>}</div>;
}
