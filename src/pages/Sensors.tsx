import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownUp, ChevronDown, ChevronLeft, ChevronRight, CirclePlus, Download, MoreHorizontal, Search, ShieldCheck, SlidersHorizontal, Wifi, WifiOff, X } from "lucide-react";
import type { FormEvent } from "react";
import type { SensorData } from "../types/sensor";
import { demoSensors } from "../data/demo";
import { loadSensors, request } from "../services/api";
import { useSensorSocket } from "../hooks/useSensorSocket";
import { getSocket } from "../services/socket";

type Provisioned = { sensor?: SensorData; data?: SensorData; deviceKey?: string };
export default function Sensors() {
  const [sensors, setSensors] = useState<SensorData[]>([]);
  const [demo, setDemo] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("latest");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [deviceKey, setDeviceKey] = useState("");
  const pageSize = 7;
  const refresh = async () => { const result = await loadSensors(); setDemo(Boolean(result.error)); setSensors(result.error ? demoSensors : result.data); };
  useEffect(() => { void refresh(); }, []);
  const onTelemetry = useCallback((reading: SensorData) => { setSensors((current) => [reading, ...current.filter((sensor) => sensor.sensorId !== reading.sensorId)]); setDemo(false); }, []);
  useSensorSocket(onTelemetry);
  useEffect(() => {
    const socket = getSocket();
    const disconnected = (event: { sensorId: string }) => setSensors((current) => current.map((sensor) => sensor.sensorId === event.sensorId ? { ...sensor, status: "offline" } : sensor));
    const updated = (event: SensorData & { removed?: boolean }) => setSensors((current) => event.removed ? current.filter((sensor) => sensor.sensorId !== event.sensorId) : current.map((sensor) => sensor.sensorId === event.sensorId ? { ...sensor, ...event } : sensor));
    socket.on("sensor:disconnected", disconnected); socket.on("sensor:updated", updated);
    return () => { socket.off("sensor:disconnected", disconnected); socket.off("sensor:updated", updated); };
  }, []);

  const filtered = useMemo(() => sensors.filter((sensor) => {
    const matches = `${sensor.sensorId} ${sensor.name ?? ""} ${sensor.location ?? ""} ${sensor.owner ?? ""}`.toLowerCase().includes(query.toLowerCase());
    return matches && (filter === "all" || sensor.status === filter);
  }).sort((a, b) => sort === "aqi" ? b.aqi - a.aqi : sort === "sensor" ? a.sensorId.localeCompare(b.sensorId) : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [sensors, query, filter, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const openSensor = (id: string) => window.dispatchEvent(new CustomEvent("breezo:navigate", { detail: `/sensors/${encodeURIComponent(id)}` }));

  const createSensor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage(""); setDeviceKey("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const latitude = String(form.get("latitude") ?? "").trim(); const longitude = String(form.get("longitude") ?? "").trim();
    const payload = { sensorId: String(form.get("sensorId")), name: String(form.get("name")), location: String(form.get("location")), latitude: latitude ? Number(latitude) : undefined, longitude: longitude ? Number(longitude) : undefined };
    try {
      const result = await request<Provisioned>("/sensors", { method: "POST", body: JSON.stringify(payload) });
      setDeviceKey(result.deviceKey ?? ""); setMessage("Sensor registered. Save the device key now; it is only shown once.");
      await refresh();
      formElement.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not register sensor"); }
    finally { setBusy(false); }
  };
  const updateStatus = async (sensor: SensorData, status: string) => {
    if (status === "online") { setMessage("A sensor becomes online only after authenticated telemetry arrives. Start its simulator or device."); return; }
    try { await request(`/sensors/${encodeURIComponent(sensor.sensorId)}`, { method: "PATCH", body: JSON.stringify({ status: "offline" }) }); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Update failed"); }
  };
  const removeSensor = async (sensor: SensorData) => {
    if (!window.confirm(`Remove ${sensor.sensorId}?`)) return;
    try { await request(`/sensors/${encodeURIComponent(sensor.sensorId)}`, { method: "DELETE" }); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Removal failed"); }
  };
  const exportCsv = () => {
    const columns = ["sensorId", "name", "location", "aqi", "pm25", "pm10", "temperature", "humidity", "status", "lastSeen", "isVerified"] as const;
    const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [columns.join(","), ...filtered.map((sensor) => columns.map((column) => cell(column === "lastSeen" ? sensor.timestamp : sensor[column])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `breezo-sensors-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  return <div className="workspace-page"><div className="page-heading"><div><div className="heading-kicker"><span className="kicker-line" /> DEVICE FLEET</div><h1>Sensor network</h1><p>Manage registered nodes and monitor their latest measurements.</p></div><div className="heading-actions"><button className="secondary-button" onClick={exportCsv}><Download size={15} /> Export CSV</button><button className="primary-button" onClick={() => { setModal(true); setMessage(""); setDeviceKey(""); }}><CirclePlus size={16} /> Register sensor</button></div></div>
    {demo && <div className="notice notice-demo"><Activity size={15} /><span>Demo fleet · showing illustrative sample nodes</span><small>Connect the API to manage live devices.</small></div>}
    {message && !modal && <div className="notice"><span>{message}</span><button onClick={() => setMessage("")} aria-label="Dismiss"><X size={15} /></button></div>}
    <section className="fleet-summary"><div><span className="summary-label">TOTAL NODES</span><strong>{sensors.length.toString().padStart(2, "0")}</strong></div><div><span className="summary-label">ONLINE</span><strong className="summary-good">{sensors.filter((s) => s.status === "online").length.toString().padStart(2, "0")}</strong></div><div><span className="summary-label">NEEDS ATTENTION</span><strong className="summary-warn">{sensors.filter((s) => s.status === "warning").length.toString().padStart(2, "0")}</strong></div><div><span className="summary-label">OFFLINE</span><strong className="summary-muted">{sensors.filter((s) => s.status === "offline").length.toString().padStart(2, "0")}</strong></div><div className="fleet-summary-health"><span><i className="pulse-dot" /> Fleet health</span><strong>{sensors.length ? Math.round((sensors.filter((s) => s.status === "online").length / sensors.length) * 100) : 0}%</strong></div></section>
    <section className="panel fleet-panel"><div className="fleet-toolbar"><div className="toolbar-title"><h2>Registered nodes</h2><span className="count-chip">{filtered.length}</span></div><div className="fleet-tools"><label className="table-search"><Search size={15} /><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search sensors..." /></label><label className="filter-select"><ArrowDownUp size={14} /><select aria-label="Sort sensors" value={sort} onChange={(e) => setSort(e.target.value)}><option value="latest">Latest</option><option value="aqi">AQI high</option><option value="sensor">Sensor ID</option></select><ChevronDown size={13} /></label><label className="filter-select"><SlidersHorizontal size={14} /><select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}><option value="all">All status</option><option value="online">Online</option><option value="warning">Warning</option><option value="offline">Offline</option></select><ChevronDown size={13} /></label></div></div><div className="table-scroll"><table className="sensor-table"><thead><tr><th>NODE</th><th>LOCATION</th><th>AQI</th><th>PM2.5</th><th>TEMPERATURE</th><th>STATUS</th><th>CHAIN</th><th /></tr></thead><tbody>{visible.map((sensor) => <tr key={sensor.sensorId}><td><button className="node-cell" onClick={() => openSensor(sensor.sensorId)}><span className={`table-node ${sensor.status}`}><Activity size={14} /></span><span><strong>{sensor.name ?? sensor.sensorId}</strong><small>{sensor.sensorId}</small></span></button></td><td><span className="location-cell">{sensor.location ?? "—"}</span></td><td><span className={`table-aqi ${sensor.aqi > 100 ? "elevated" : ""}`}>{sensor.status === "offline" ? "—" : sensor.aqi}</span></td><td>{sensor.status === "offline" ? "—" : <>{sensor.pm25.toFixed(1)} <small>µg/m³</small></>}</td><td>{sensor.status === "offline" ? "—" : `${sensor.temperature.toFixed(1)}°`}</td><td><span className={`status-label ${sensor.status}`}><i />{sensor.status}</span></td><td>{sensor.isVerified ? <span className="verified-pill"><ShieldCheck size={12} /> Verified</span> : <span className="chain-unverified">Unverified</span>}</td><td><div className="row-actions"><button title={sensor.status === "offline" ? "Activate" : "Deactivate"} onClick={() => void updateStatus(sensor, sensor.status === "offline" ? "online" : "offline")}>{sensor.status === "offline" ? <Wifi size={15} /> : <WifiOff size={15} />}</button><button title="Remove sensor" onClick={() => void removeSensor(sensor)}><MoreHorizontal size={16} /></button></div></td></tr>)}</tbody></table>{!visible.length && <div className="empty-state"><Search size={23} /><strong>No matching sensors</strong><span>Try changing your search or filters.</span></div>}</div><div className="table-footer"><span>Showing {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} nodes</span><div><button disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button></div></div></section>
    {modal && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(false); }}><section className="modal-card"><div className="modal-heading"><div><span className="eyebrow">DEVICE PROVISIONING</span><h2>Register a sensor</h2><p>Add a node to your network.</p></div><button className="icon-button" onClick={() => setModal(false)} aria-label="Close"><X size={18} /></button></div>{deviceKey ? <div className="provision-key"><ShieldCheck size={19} /><strong>Save this device key</strong><code>{deviceKey}</code><p>Copy it to the simulator or device configuration now. It will not be shown again.</p><button className="primary-button" onClick={() => { void navigator.clipboard?.writeText(deviceKey); setMessage("Device key copied. Keep it secret."); setModal(false); }}>Copy and finish</button></div> : <form className="sensor-form" onSubmit={createSensor}><label>Sensor ID<input name="sensorId" required placeholder="ESP32-005" pattern="[A-Za-z0-9_-]{3,48}" /></label><label>Display name<input name="name" placeholder="Rooftop sensor" /></label><label>Location<input name="location" required placeholder="District, City" /></label><div className="form-row"><label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90" placeholder="27.7172" /></label><label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180" placeholder="85.3240" /></label></div>{message && <div className="form-error">{message}</div>}<button className="primary-button full-button" disabled={busy}>{busy ? "Registering…" : "Register sensor"}</button><small className="form-hint">Requires an ADMIN or NODE_OPERATOR session. The device key is returned once.</small></form>}</section></div>}
  </div>;
}
