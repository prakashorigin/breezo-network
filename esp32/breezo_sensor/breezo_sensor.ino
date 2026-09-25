#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WiFi.h>
#include <time.h>
#include "config.h"
#include "crypto.h"
#include "sensor.h"

Preferences preferences;
uint64_t sequenceNumber = 0;
unsigned long lastPost = 0;

String utcTimestamp() {
  struct tm timeInfo;
  if (!getLocalTime(&timeInfo, 1000)) return "";
  char value[25]; strftime(value, sizeof(value), "%Y-%m-%dT%H:%M:%SZ", &timeInfo);
  return String(value);
}

String jsonNumber(float value) {
  char buffer[24]; snprintf(buffer, sizeof(buffer), "%.1f", value);
  String output(buffer);
  while (output.endsWith("0")) output.remove(output.length() - 1);
  if (output.endsWith(".")) output.remove(output.length() - 1);
  return output;
}

String readingsJson(const SensorReading &reading) {
  return String("{\"humidity\":") + jsonNumber(reading.humidity)
    + ",\"pm10\":" + jsonNumber(reading.pm10)
    + ",\"pm25\":" + jsonNumber(reading.pm25)
    + ",\"temperature\":" + jsonNumber(reading.temperature) + "}";
}

void sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED) return;
  const String timestamp = utcTimestamp();
  if (timestamp.isEmpty()) { Serial.println("Waiting for NTP time sync"); return; }
  const SensorReading reading = readSensorValues();
  sequenceNumber++;
  preferences.putULong64("sequence", sequenceNumber);
  char timestampBuffer[24]; snprintf(timestampBuffer, sizeof(timestampBuffer), "%llu", static_cast<unsigned long long>(time(nullptr)) * 1000ULL);
  char sequenceBuffer[24]; snprintf(sequenceBuffer, sizeof(sequenceBuffer), "%llu", static_cast<unsigned long long>(sequenceNumber));
  const String timestampHeader(timestampBuffer);
  const String sequenceHeader(sequenceBuffer);
  const String nonce = createNonce();
  const String associatedData = String(BREEZO_DEVICE_ID) + "." + sequenceHeader + "." + timestamp;
  const String encrypted = encryptPayload(readingsJson(reading), BREEZO_DEVICE_KEY, associatedData);
  if (encrypted.isEmpty()) { Serial.println("Could not encrypt telemetry payload"); return; }
  // Keep envelope keys lexicographically sorted for the backend's HMAC canonicalization.
  const String body = String("{\"encrypted\":") + encrypted + ",\"sensorId\":\"" + BREEZO_DEVICE_ID + "\",\"sequenceNumber\":" + sequenceHeader + ",\"timestamp\":\"" + timestamp + "\"}";
  const String message = timestampHeader + "." + sequenceHeader + "." + nonce + "." + body;
  const String signature = hmacSha256Hex(message, BREEZO_DEVICE_KEY);

  HTTPClient http;
  http.begin(BREEZO_API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-sensor-timestamp", timestampHeader);
  http.addHeader("x-sensor-sequence", sequenceHeader);
  http.addHeader("x-sensor-nonce", nonce);
  http.addHeader("x-sensor-signature", signature);
  const int status = http.POST(body);
  Serial.printf("telemetry status=%d sequence=%llu\n", status, static_cast<unsigned long long>(sequenceNumber));
  http.end();
}

void setup() {
  Serial.begin(115200);
  preferences.begin("breezo", false);
  sequenceNumber = preferences.getULong64("sequence", 0);
  WiFi.mode(WIFI_STA); WiFi.begin(BREEZO_WIFI_SSID, BREEZO_WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) { delay(400); Serial.print("."); }
  Serial.printf("\nConnected, IP %s\n", WiFi.localIP().toString().c_str());
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  randomSeed(esp_random());
}

void loop() {
  if (millis() - lastPost >= BREEZO_POST_INTERVAL_MS) { lastPost = millis(); sendTelemetry(); }
  delay(20);
}
