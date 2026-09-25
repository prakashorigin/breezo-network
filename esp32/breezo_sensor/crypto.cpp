#include "crypto.h"
#include <mbedtls/base64.h>
#include <mbedtls/gcm.h>
#include <mbedtls/md.h>
#include <mbedtls/sha256.h>
#include <stdlib.h>

String hmacSha256Hex(const String &message, const String &secret) {
  uint8_t digest[32];
  const auto *info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  mbedtls_md_hmac(info, reinterpret_cast<const unsigned char *>(secret.c_str()), secret.length(), reinterpret_cast<const unsigned char *>(message.c_str()), message.length(), digest);
  static const char hex[] = "0123456789abcdef";
  String output; output.reserve(64);
  for (const uint8_t byte : digest) { output += hex[byte >> 4]; output += hex[byte & 0x0f]; }
  return output;
}

String createNonce() {
  static const char hex[] = "0123456789abcdef";
  String output; output.reserve(32);
  for (int index = 0; index < 16; index++) { const uint8_t value = static_cast<uint8_t>(esp_random()); output += hex[value >> 4]; output += hex[value & 0x0f]; }
  return output;
}

String base64Url(const uint8_t *data, size_t length) {
  const size_t capacity = ((length + 2) / 3) * 4 + 1;
  char *buffer = static_cast<char *>(malloc(capacity));
  if (!buffer) return "";
  size_t outputLength = 0;
  const int result = mbedtls_base64_encode(reinterpret_cast<unsigned char *>(buffer), capacity - 1, &outputLength, data, length);
  if (result != 0) { free(buffer); return ""; }
  buffer[outputLength] = '\0';
  String output(buffer); free(buffer);
  output.replace("+", "-"); output.replace("/", "_");
  while (output.endsWith("=")) output.remove(output.length() - 1);
  return output;
}

String encryptPayload(const String &plaintext, const String &secret, const String &associatedData) {
  uint8_t key[32]; uint8_t iv[12]; uint8_t tag[16];
  mbedtls_sha256_ret(reinterpret_cast<const unsigned char *>(secret.c_str()), secret.length(), key, 0);
  for (uint8_t &byte : iv) byte = static_cast<uint8_t>(esp_random());
  uint8_t *ciphertext = static_cast<uint8_t *>(malloc(plaintext.length() + 1));
  if (!ciphertext) return "";
  mbedtls_gcm_context context; mbedtls_gcm_init(&context);
  int result = mbedtls_gcm_setkey(&context, MBEDTLS_CIPHER_ID_AES, key, 256);
  if (result == 0) result = mbedtls_gcm_crypt_and_tag(&context, MBEDTLS_GCM_ENCRYPT, plaintext.length(), iv, sizeof(iv), reinterpret_cast<const unsigned char *>(associatedData.c_str()), associatedData.length(), reinterpret_cast<const unsigned char *>(plaintext.c_str()), ciphertext, sizeof(tag), tag);
  mbedtls_gcm_free(&context);
  if (result != 0) { free(ciphertext); return ""; }
  const String encrypted = base64Url(ciphertext, plaintext.length());
  const String encodedIv = base64Url(iv, sizeof(iv));
  const String encodedTag = base64Url(tag, sizeof(tag));
  free(ciphertext);
  if (encrypted.isEmpty() || encodedIv.isEmpty() || encodedTag.isEmpty()) return "";
  // Inner keys are lexicographically sorted to match the backend canonical JSON.
  return String("{\"ciphertext\":\"") + encrypted + "\",\"iv\":\"" + encodedIv + "\",\"tag\":\"" + encodedTag + "\"}";
}
