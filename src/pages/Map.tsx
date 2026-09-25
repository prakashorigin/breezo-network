import { useCallback, useEffect, useState } from "react";
import { Activity, MapPin, Radio } from "lucide-react";
import { SensorMap } from "../components/SensorMap";
import { LiveIndicator } from "../components/LiveIndicator";
import { demoSensors } from "../data/demo";
import { loadSensors } from "../services/api";
import type { SensorData } from "../types/sensor";
import { useSensorSocket } from "../hooks/useSensorSocket";
import { getSocket } from "../services/socket";
export default function MapPage() {
  const [sensors, setSensors] = useState<SensorData[]>([]); const [demo, setDemo] = useState(false);
  const onTelemetry = useCallback((reading: SensorData) => { setSensors((current) => [reading, ...current.filter((sensor) => sensor.sensorId !== reading.sensorId)]); setDemo(false); }, []);
  const connected = useSensorSocket(onTelemetry);
  useEffect(() => {
    const socket = getSocket();
    const disconnected = (event: { sensorId: string }) => setSensors((current) => current.map((sensor) => sensor.sensorId === event.sensorId ? { ...sensor, status: "offline" } : sensor));
    const updated = (event: SensorData & { removed?: boolean }) => setSensors((current) => event.removed ? current.filter((sensor) => sensor.sensorId !== event.sensorId) : current.map((sensor) => sensor.sensorId === event.sensorId ? { ...sensor, ...event } : sensor));
    socket.on("sensor:disconnected", disconnected); socket.on("sensor:updated", updated);
    return () => { socket.off("sensor:disconnected", disconnected); socket.off("sensor:updated", updated); };
  }, []);
  useEffect(() => { void loadSensors().then((result) => { setDemo(Boolean(result.error)); setSensors(result.error ? demoSensors : result.data); }); }, []);
  const open = (id: string) => window.dispatchEvent(new CustomEvent("breezo:navigate", { detail: `/sensors/${encodeURIComponent(id)}` }));
  return <div className="workspace-page"><div className="page-heading"><div><div className="heading-kicker"><span className="kicker-line" /> GEOSPATIAL INTELLIGENCE</div><h1>Network map</h1><p>Explore sensor coverage and local air conditions.</p></div><div className="heading-actions"><LiveIndicator connected={connected} demo={demo} /><span className="map-provider-label">OpenStreetMap tiles</span></div></div>{demo && <div className="notice notice-demo"><Activity size={15} /><span>Sample coordinates shown · illustrative data only</span></div>}<div className="map-summary"><span><MapPin size={15} /> {sensors.filter((s) => s.latitude !== undefined && s.longitude !== undefined).length} nodes with coordinates</span><span><i className="legend-online" /> {sensors.filter((s) => s.status === "online").length} online</span><span><i className="legend-warning" /> {sensors.filter((s) => s.status === "warning").length} needs attention</span><span><i className="legend-offline" /> {sensors.filter((s) => s.status === "offline").length} offline</span></div><section className="panel full-map-panel"><div className="map-title-overlay"><div className="map-overlay-icon"><Radio size={15} /></div><div><strong>Kathmandu Valley</strong><span>Sensor coverage overview</span></div><span className="map-overlay-count">{sensors.length} NODES</span></div><SensorMap sensors={sensors} onOpen={open} /><div className="aqi-marker-legend"><span><i className="marker-good" /> Good</span><span><i className="marker-moderate" /> Moderate</span><span><i className="marker-unhealthy" /> Unhealthy</span><span><i className="marker-danger" /> Dangerous</span><span><i className="marker-offline" /> Offline</span></div></section><div className="map-caption"><span>Map tiles © OpenStreetMap contributors</span><span>Markers open sensor details · AQI color shows current conditions</span></div></div>;
}
