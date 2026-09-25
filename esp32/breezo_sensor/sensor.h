#pragma once
struct SensorReading {
  float pm25;
  float pm10;
  float temperature;
  float humidity;
};
SensorReading readSensorValues();
