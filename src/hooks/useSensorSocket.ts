import { useEffect, useState } from "react";
import type { SensorData } from "../types/sensor";
import { getSocket } from "../services/socket";

export function useSensorSocket(onTelemetry: (reading: SensorData) => void) {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onData = (reading: SensorData) => onTelemetry(reading);
    socket.on("connect", onConnect); socket.on("disconnect", onDisconnect);
    socket.on("sensor:telemetry", onData);
    socket.connect();
    return () => { socket.off("connect", onConnect); socket.off("disconnect", onDisconnect); socket.off("sensor:telemetry", onData); };
  }, [onTelemetry]);
  return connected;
}
