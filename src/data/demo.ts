import type { SensorData } from "../types/sensor";

export const demoSensors: SensorData[] = [
  { sensorId: "ESP32-001", name: "Thamel rooftop", location: "Thamel, Kathmandu", owner: "Breezo Lab", aqi: 42, pm25: 10.8, pm10: 21.4, temperature: 24.7, humidity: 58, status: "online", isVerified: true, latitude: 27.7152, longitude: 85.3123, timestamp: new Date(Date.now() - 18_000).toISOString() },
  { sensorId: "ESP32-002", name: "Patan community hub", location: "Patan, Lalitpur", owner: "Community Air", aqi: 76, pm25: 23.2, pm10: 41.6, temperature: 26.1, humidity: 62, status: "online", isVerified: true, latitude: 27.6648, longitude: 85.3188, timestamp: new Date(Date.now() - 41_000).toISOString() },
  { sensorId: "ESP32-003", name: "Ring Road east", location: "Koteshwor, Kathmandu", owner: "Urban Lab", aqi: 118, pm25: 42.7, pm10: 66.3, temperature: 28.2, humidity: 49, status: "warning", isVerified: false, latitude: 27.6784, longitude: 85.3473, timestamp: new Date(Date.now() - 67_000).toISOString() },
  { sensorId: "ESP32-004", name: "Boudha garden", location: "Boudha, Kathmandu", owner: "Breezo Lab", aqi: 0, pm25: 0, pm10: 0, temperature: 0, humidity: 0, status: "offline", isVerified: false, latitude: 27.7215, longitude: 85.3620, timestamp: new Date(Date.now() - 1_020_000).toISOString() },
];

export function demoHistory() {
  return Array.from({ length: 24 }, (_, index) => {
    const date = new Date(Date.now() - (23 - index) * 60 * 60 * 1000);
    const wave = Math.sin(index * 0.62) * 13 + Math.cos(index * 0.19) * 8;
    return { timestamp: date.toISOString(), label: date.toLocaleTimeString([], { hour: "2-digit" }), aqi: Math.round(66 + wave), pm25: Math.round((19 + wave / 3) * 10) / 10, pm10: Math.round((34 + wave / 2) * 10) / 10, temperature: Math.round((25 + Math.sin(index / 4) * 2) * 10) / 10, humidity: Math.round(58 + Math.cos(index / 5) * 8) };
  });
}
