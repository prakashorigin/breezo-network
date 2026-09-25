export interface SensorData {
  sensorId: string;
  aqi: number;
  pm25: number;
  pm10: number;
  temperature: number;
  humidity: number;
  status: "online" | "offline" | "warning";
  owner?: string;
  location?: string;
  name?: string;
  isVerified?: boolean;
  blockchainAddress?: string;
  latitude?: number;
  longitude?: number;
  timestamp: string;
}
