import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Activity } from "lucide-react";
import { StatCard } from "../src/components/StatCard.js";
import { SensorCard } from "../src/components/SensorCard.js";
import type { SensorData } from "../src/types/sensor.js";

test("stat card renders value, unit, and metric context", () => {
  const markup = renderToStaticMarkup(createElement(StatCard, { label: "PM2.5", value: 18.4, unit: "µg/m³", icon: createElement(Activity), note: "Network average", tone: "blue" }));
  assert.match(markup, /PM2\.5/);
  assert.match(markup, /18\.4/);
  assert.match(markup, /µg\/m³/);
  assert.match(markup, /Network average/);
});

test("sensor card renders an online node without invoking its action during render", () => {
  let opened = "";
  const sensor: SensorData = { sensorId: "ESP32-001", name: "Rooftop", location: "Kathmandu", aqi: 42, pm25: 10, pm10: 20, temperature: 24, humidity: 50, status: "online", timestamp: new Date().toISOString() };
  const markup = renderToStaticMarkup(createElement(SensorCard, { sensor, onOpen: (sensorId: string) => { opened = sensorId; } }));
  assert.match(markup, /Rooftop/);
  assert.match(markup, /online/);
  assert.equal(opened, "");
});

test("sensor card does not expose a zero AQI for an offline node", () => {
  const sensor: SensorData = { sensorId: "ESP32-002", location: "Lalitpur", aqi: 0, pm25: 0, pm10: 0, temperature: 0, humidity: 0, status: "offline", timestamp: new Date().toISOString() };
  const markup = renderToStaticMarkup(createElement(SensorCard, { sensor, onOpen: () => undefined }));
  assert.match(markup, /offline/);
  assert.match(markup, /—/);
});
