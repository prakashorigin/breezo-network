#pragma once
#include <Arduino.h>
String hmacSha256Hex(const String &message, const String &secret);
String createNonce();
String encryptPayload(const String &plaintext, const String &secret, const String &associatedData);
