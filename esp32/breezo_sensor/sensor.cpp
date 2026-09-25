#include "sensor.h"
#include <Arduino.h>
#include <math.h>

// Demonstration source. Replace these generated values with your PM sensor and
// temperature/humidity driver reads before deploying hardware.
SensorReading readSensorValues() {
  const float phase = millis() / 60000.0f;
  const float variation = sinf(phase) * 5.0f;
  return {
    18.0f + variation + random(-20, 21) / 10.0f,
    34.0f + variation * 1.4f + random(-30, 31) / 10.0f,
    25.0f + sinf(phase / 3.0f) * 1.8f,
    58.0f + cosf(phase / 4.0f) * 9.0f
  };
}
