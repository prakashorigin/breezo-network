import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Cloud, Droplets, Gauge, Leaf, Thermometer, Wind } from "lucide-react";
import { StatCard } from "../components/StatCard";
import { AQIChart } from "../components/AQIChart";
import { SensorMap } from "../components/SensorMap";
import { SensorCard } from "../components/SensorCard";
import { LiveIndicator } from "../components/LiveIndicator";
import { RecentActivity, type ActivityItem } from "../components/RecentActivity";
import { demoHistory, demoSensors } from "../data/demo";
import { loadSensors, request } from "../services/api";
import { useSensorSocket } from "../hooks/useSensorSocket";
import { getSocket } from "../services/socket";
import type { SensorData } from "../types/sensor";

type Point = { timestamp?: string; label: string; aqi: number; pm25?: number; pm10?: number; temperature?: number; humidity?: number };
function timeAgo(timestamp: string) { const seconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)); return seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`; }

export default function Dashboard() {
  const [sensors, setSensors] = useState<SensorData[]>([]);
  const [history, setHistory] = useState<Point[]>([]);
  const [demo, setDemo] = useState(false);
  const [apiError, setApiError] = useState("");
  const [range, setRange] = useState("24H");
  const [updated, setUpdated] = useState(new Date());
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const onTelemetry = useCallback((reading: SensorData) => {
    setSensors((current) => [reading, ...current.filter((sensor) => sensor.sensorId !== reading.sensorId)]);
    setHistory((current) => [...current.slice(-47), { label: new Date(reading.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), aqi: reading.aqi }]);
    setActivity((current) => [{ id: `${reading.sensorId}-${reading.timestamp}`, sensorId: reading.sensorId, label: "Telemetry received", timestamp: reading.timestamp, tone: "telemetry" as const }, ...current].slice(0, 8));
    setDemo(false); setUpdated(new Date());
  }, []);
  const socketConnected = useSensorSocket(onTelemetry);

  useEffect(() => {
    const socket = getSocket();
    const connected = (reading: SensorData) => { setSensors((current) => [{ ...reading, status: "online" }, ...current.filter((s) => s.sensorId !== reading.sensorId)]); setActivity((current) => [{ id: `connected-${reading.sensorId}-${Date.now()}`, sensorId: reading.sensorId, label: "Sensor connected", timestamp: new Date().toISOString(), tone: "connected" as const }, ...current].slice(0, 8)); };
    const disconnected = (event: { sensorId: string; lastSeen?: string }) => { setSensors((current) => current.map((sensor) => sensor.sensorId === event.sensorId ? { ...sensor, status: "offline" } : sensor)); setActivity((current) => [{ id: `offline-${event.sensorId}-${Date.now()}`, sensorId: event.sensorId, label: "No telemetry · node offline", timestamp: new Date().toISOString(), tone: "offline" as const }, ...current].slice(0, 8)); };
    const warning = (event: SensorData) => { setActivity((current) => [{ id: `warning-${event.sensorId}-${Date.now()}`, sensorId: event.sensorId, label: `Air quality warning · AQI ${event.aqi}`, timestamp: new Date().toISOString(), tone: "warning" as const }, ...current].slice(0, 8)); };
    const updatedSensor = (event: SensorData & { removed?: boolean }) => { setSensors((current) => event.removed ? current.filter((sensor) => sensor.sensorId !== event.sensorId) : current.map((sensor) => sensor.sensorId === event.sensorId ? { ...sensor, ...event } : sensor)); };
    socket.on("sensor:connected", connected); socket.on("sensor:disconnected", disconnected); socket.on("sensor:warning", warning); socket.on("sensor:updated", updatedSensor);
    return () => { socket.off("sensor:connected", connected); socket.off("sensor:disconnected", disconnected); socket.off("sensor:warning", warning); socket.off("sensor:updated", updatedSensor); };
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const response = await loadSensors();
      if (!active) return;
      if (response.error) { setDemo(true); setApiError(response.error); setSensors(demoSensors); }
      else { setApiError(""); setDemo(false); setSensors(response.data); }
      try {
        const historyResponse = await request<Point[]>(`/analytics/timeseries?range=${range.toLowerCase()}`);
        if (active) setHistory(historyResponse.map((point) => ({ ...point, label: point.label ?? new Date(point.timestamp ?? "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })));
      } catch { if (active && response.error) setHistory(demoHistory()); }
      setUpdated(new Date());
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [range]);

  const activeSensors = sensors.filter((sensor) => sensor.status !== "offline");
  const latest = activeSensors.length ? activeSensors.reduce((a, b) => a.timestamp > b.timestamp ? a : b) : null;
  const average = (field: "aqi" | "pm25" | "pm10" | "temperature" | "humidity") => activeSensors.length ? Math.round(activeSensors.reduce((sum, sensor) => sum + sensor[field], 0) / activeSensors.length * 10) / 10 : 0;
  const aqiText = average("aqi") <= 50 ? "Good conditions" : average("aqi") <= 100 ? "Moderate conditions" : "Air quality alert";
  const chartData = history.length ? history : (demo ? demoHistory() : []);
  const openSensor = (id: string) => window.dispatchEvent(new CustomEvent("breezo:navigate", { detail: `/sensors/${encodeURIComponent(id)}` }));
  const trend = useMemo(() => demo ? "Illustrative readings" : socketConnected ? "Streaming from API" : "Waiting for telemetry", [demo, socketConnected]);
  const activityItems = activity.length ? activity : demo ? demoSensors.slice(0, 4).map((sensor, index) => ({ id: `demo-${sensor.sensorId}`, sensorId: sensor.sensorId, label: ["AQI reading received", "Sensor connected", "Elevated particulate warning", "Node has stopped reporting"][index], timestamp: new Date(Date.now() - index * 240_000).toISOString(), tone: (["telemetry", "connected", "warning", "offline"] as const)[index] })) : [];

  return <div className="dashboard-page">
    <div className="page-heading"><div><div className="heading-kicker"><span className="kicker-line" /> ENVIRONMENTAL INTELLIGENCE</div><h1>Air quality overview</h1><p>A live view of the air your network is measuring.</p></div><div className="heading-actions"><LiveIndicator connected={socketConnected} demo={demo} /><span className="date-button"><span className="date-dot" /> Last 24 hours</span></div></div>
    {apiError && <div className="notice notice-demo"><Activity size={15} /><span>API unavailable · showing illustrative sample data</span><small>{apiError}</small></div>}

    <section className="stats-grid" aria-label="Network metrics">
      <StatCard label="Network AQI" value={latest ? average("aqi") : "—"} icon={<Gauge size={17} />} trend={latest ? aqiText : undefined} note="US AQI · network avg" tone="mint" />
      <StatCard label="PM2.5" value={latest ? average("pm25") : "—"} unit="µg/m³" icon={<Wind size={17} />} trend={latest ? "Fine particles" : undefined} note="2.5 micron particulate" tone="blue" />
      <StatCard label="PM10" value={latest ? average("pm10") : "—"} unit="µg/m³" icon={<Cloud size={17} />} trend={latest ? "Coarse particles" : undefined} note="10 micron particulate" tone="purple" />
      <StatCard label="Temperature" value={latest ? average("temperature") : "—"} unit="°C" icon={<Thermometer size={17} />} trend={latest ? "Ambient" : undefined} note="Network average" tone="amber" />
    </section>

    <section className="primary-grid"><AQIChart data={chartData} range={range} onRange={setRange} demo={demo && !socketConnected} /><aside className="panel conditions-panel"><div className="panel-heading compact-heading"><div><span className="eyebrow">LIVE CONDITIONS</span><h2>Network pulse</h2></div><span className="soft-live-dot" /></div><div className="condition-main"><div className={`condition-number ${average("aqi") > 100 ? "warning" : ""}`}>{latest ? average("aqi") : "—"}</div><div className="condition-copy"><strong>{latest ? (average("aqi") <= 50 ? "Good" : average("aqi") <= 100 ? "Moderate" : "Elevated") : "Awaiting data"}</strong><span>{aqiText}</span></div><div className="condition-ring"><Leaf size={23} /></div></div><div className="condition-scale"><span>Good</span><div className="scale-bar"><i style={{ left: `${Math.min(100, Math.max(3, average("aqi") / 3))}%` }} /></div><span>Hazardous</span></div><div className="condition-divider" /><div className="condition-stat"><div className="condition-stat-icon humidity"><Droplets size={16} /></div><span>Humidity</span><strong>{latest ? `${average("humidity")}%` : "—"}</strong></div><div className="condition-stat"><div className="condition-stat-icon nodes"><RadioIcon /></div><span>Online nodes</span><strong>{activeSensors.length}<small> / {sensors.length}</small></strong></div><div className="condition-updated"><span>Last network update</span><strong>{socketConnected && latest ? timeAgo(latest.timestamp) : updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong></div></aside></section>

    <section className="secondary-grid"><div className="panel map-panel"><div className="panel-heading"><div><span className="eyebrow">GEOSPATIAL NETWORK</span><h2>Sensor locations</h2><p>Coverage across the Kathmandu valley</p></div><button className="text-action" onClick={() => window.dispatchEvent(new CustomEvent("breezo:navigate", { detail: "/map" }))}>Open map <ArrowRight size={14} /></button></div><SensorMap sensors={sensors} onOpen={openSensor} compact /><div className="map-legend"><span><i className="legend-online" /> Online</span><span><i className="legend-warning" /> Attention</span><span><i className="legend-offline" /> Offline</span><span className="map-updated">{demo ? "Sample locations" : "OpenStreetMap"}</span></div></div><div className="panel sensors-panel"><div className="panel-heading"><div><span className="eyebrow">NODE ACTIVITY</span><h2>Sensor network</h2><p>{activeSensors.length} nodes reporting right now</p></div><button className="text-action" onClick={() => window.dispatchEvent(new CustomEvent("breezo:navigate", { detail: "/sensors" }))}>View all <ArrowRight size={14} /></button></div><div className="sensor-list">{sensors.slice(0, 4).map((sensor) => <SensorCard key={sensor.sensorId} sensor={sensor} onOpen={openSensor} />)}{!sensors.length && <div className="empty-inline"><Activity size={18} /><span>No registered sensors yet</span><small>Register an ESP32 node to see telemetry here.</small></div>}</div><div className="sensor-panel-footer"><span><i className="pulse-dot" /> {socketConnected ? "Socket stream connected" : demo ? "Demo environment" : "Listening for sensor data"}</span><span>{trend}</span></div></div></section>
    <RecentActivity items={activityItems} demo={demo && !activity.length} />
  </div>;
}
function RadioIcon() { return <Activity size={16} />; }
