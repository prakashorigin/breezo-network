# BREEZO API

Base URL: `http://localhost:6001/api`

Responses use `{ "success": true, "data": ... }`. Failures use `{ "success": false, "message": "..." }` and, for validation errors, an `errors` array. Account endpoints use a JWT bearer token. Sensor reads are public; sensor writes require `ADMIN` or `NODE_OPERATOR`, while verification and user management require `ADMIN`.

## Health

### `GET /health`

No authentication. Returns API availability plus MongoDB connection state. A healthy HTTP response does not mean MongoDB is connected; check `services.database`.

## Authentication

### `POST /auth/register`

Body: `{ "name": "A name", "email": "person@example.com", "password": "at-least-8-characters" }`. Creates a `VIEWER` account and returns a JWT and user profile. Role elevation is performed by an administrator.

### `POST /auth/login`

Body: `{ "email": "person@example.com", "password": "..." }`. Returns a JWT and profile. Tokens expire according to `JWT_EXPIRES_IN`.

### `POST /auth/logout`

Client removes its bearer token. JWTs are stateless, so this endpoint does not revoke a stolen token.

### `GET /auth/me`

Bearer token required. Returns the current profile.

## Sensor fleet

### `GET /sensors`

Public. Optional `status=online|offline|warning`. Operators receive their own sensor list when a token is supplied; admins see all nodes.

### `GET /sensors/:sensorId`

Public sensor profile, coordinates, latest status, and verification metadata.

### `POST /sensors`

`ADMIN` or `NODE_OPERATOR`. Body: `{ "sensorId": "ESP32-001", "name": "Rooftop", "location": "Kathmandu", "latitude": 27.71, "longitude": 85.31 }`. Returns the sensor and a randomly generated `deviceKey` once. Store this key securely in device configuration; the backend stores it encrypted and hashed.

### `PATCH /sensors/:sensorId`

Owner operator or admin. Can update `name`, `location`, coordinate pair, and set `status: "offline"` to deactivate. Online status is set only after authenticated telemetry is accepted.

### `DELETE /sensors/:sensorId`

Owner operator or admin. Permanently removes the sensor, its telemetry history, and reward records.

### `POST /sensors/:sensorId/verify`

Admin only. Marks a node verified in MongoDB. This is separate from the Anchor program's on-chain verification.

### `POST /sensors/:sensorId/rotate-key`

Owner operator or admin. Replaces the device credential, resets sequence state, and returns the new one-time key.

## Telemetry

### `POST /telemetry`

Signed device request. JSON body:

```json
{
  "sensorId": "ESP32-001",
  "sequenceNumber": 120,
  "timestamp": "2026-09-25T10:30:00.000Z",
  "encrypted": {
    "iv": "12-byte-base64url-value",
    "tag": "16-byte-base64url-value",
    "ciphertext": "aes-256-gcm-ciphertext-base64url"
  }
}
```

Headers: `x-sensor-timestamp` (Unix milliseconds), `x-sensor-sequence`, `x-sensor-nonce` (unique random base64url token), and `x-sensor-signature` (HMAC-SHA256 hex). Readings are AES-256-GCM encrypted using a per-device derived key; associated data binds sensor ID, sequence and payload timestamp. Signature input is `timestamp.sequence.nonce.canonicalJson(body)`, where object keys are sorted recursively. Timestamp/body must be within `SENSOR_CLOCK_TOLERANCE_SECONDS`; nonce reuse and non-increasing sequence numbers are rejected. AQI is calculated on the server from decrypted PM2.5 and PM10; any client-supplied AQI is not trusted.

### `GET /telemetry/:sensorId`

Public historical readings. Optional `limit` (1–500, default 100) and `since` ISO timestamp. Results are chronological.

## Analytics

### `GET /analytics/network?range=1h|6h|24h|7d|30d`

Returns average, minimum, and maximum AQI; average PM2.5 and PM10; active/offline sensor counts; and telemetry count for the window.

### `GET /analytics/timeseries?range=...`

Returns time-bucketed averages for AQI, PM2.5, PM10, temperature, and humidity.

### `GET /analytics/sensors?range=1h|6h|24h|7d|30d`

Returns each node's status, report count, first/last seen, and a coarse report-based uptime ratio for the selected time window.

## Rewards and users

### `GET /rewards`

Admins see all records; authenticated users see their owned sensors' records; anonymous callers see only claimed records.

### `POST /rewards/claim`

Returns `501` until a deployed Anchor program, reward mint, treasury, and signing service are configured. The API never reports an unsubmitted transaction as confirmed.

### `GET /users`

Admin only. Returns workspace account profiles.

### `PATCH /users/:userId/role`

Admin only. Body: `{ "role": "ADMIN|NODE_OPERATOR|VIEWER" }`. The last admin cannot demote their own account.
