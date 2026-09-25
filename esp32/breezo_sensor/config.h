#pragma once

// Copy local credentials into secrets.h (ignored by git) before flashing.
#if __has_include("secrets.h")
#include "secrets.h"
#else
#define BREEZO_WIFI_SSID "YOUR_WIFI_NAME"
#define BREEZO_WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define BREEZO_DEVICE_ID "ESP32-001"
#define BREEZO_DEVICE_KEY "PROVISION_THIS_KEY_IN_THE_DASHBOARD"
#endif

#define BREEZO_API_URL "http://192.168.1.10:6001/api/telemetry"
#define BREEZO_POST_INTERVAL_MS 2000
#define BREEZO_CLOCK_TOLERANCE_NOTE "Use a reachable API host and synchronized NTP clock"
