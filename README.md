# BREEZO Network

BREEZO is a real-time air quality monitoring workspace for ESP32 sensor nodes. It combines a React dashboard, an authenticated Express API, MongoDB telemetry history, Socket.IO updates, a signed sensor simulator, and a Solana Anchor program scaffold for sensor ownership and SPL contribution rewards.

> The dashboard's sample readings are explicitly labeled and only appear when the API is unavailable. A connected API with no registered devices displays an empty fleet. Blockchain pages report wallet connection and Devnet balance only; no transaction is claimed until a deployed program actually confirms one.

## Architecture

```text
ESP32 / Simulator ── HMAC telemetry ──> Express API ──> MongoDB
                                             │             │
                                             └─ Socket.IO ─┴─> React dashboard

Browser wallet ──> Solana Devnet (Anchor registration and SPL claim program)
```

High-frequency sensor readings remain in MongoDB. The Anchor program stores sensor ownership, verification and reward balances. Backend validation calculates AQI, persists accepted measurements, broadcasts Socket.IO events, and accrues an off-chain pending reward ledger for each 50 accepted readings. The ledger does not submit blockchain transactions; token claims require the Anchor program, a funded treasury and a signing workflow.

## Workspace

The existing Vite app remains at the repository root so the original `src/` IDE paths continue to work. Service workspaces are separated by responsibility:

```text
breezo-network/
├── src/                       # React + TypeScript frontend
├── backend/src/               # Express, Mongoose, auth, telemetry, Socket.IO
├── simulator/src/             # Signed multi-node simulator
├── esp32/breezo_sensor/        # Arduino ESP32 reference firmware
├── blockchain/                # Anchor + Rust program and integration test
├── docs/api.md
├── docker-compose.yml
├── .env.example
└── README.md
```

## Features

- Responsive dark operations dashboard with AQI, particulate, temperature and humidity cards, charts, recent sensor fleet, map and network status.
- Sensor search, status filters, pagination, provisioning, details, deactivation and removal.
- Historical analytics filters for 1 hour, 6 hours, 24 hours, 7 days and 30 days.
- JWT accounts with bcrypt password hashing and `ADMIN`, `NODE_OPERATOR`, and `VIEWER` roles.
- MongoDB models and time-oriented telemetry indexes.
- Socket.IO telemetry, sensor lifecycle, warning and network events.
- Per-device AES-256-GCM encrypted readings, HMAC-SHA256 signatures, AES-GCM encrypted device keys at rest, nonce uniqueness, sequence enforcement, timestamp checks and schema validation.
- Sensor simulator sends changing measurements every 2 seconds. It can create multiple nodes.
- Leaflet map uses OpenStreetMap tiles.
- Devnet wallet connection and SOL balance inspection when a compatible browser wallet is installed.
- Anchor PDAs for sensor identity, admin verification, reward accrual and SPL token transfer on claim.

## Screenshots

Screenshots are not committed yet. Run the frontend and backend locally to capture the dashboard with your own sensor data; the fallback dashboard marks its example readings as demo data.

## Requirements

- Node.js 20 or newer and npm.
- MongoDB 7 or newer, either local or through Docker.
- Optional for blockchain work: Rust, Solana CLI, Anchor 0.30.1, and a Devnet wallet.
- Optional for hardware: ESP32 Arduino core, ArduinoJson, Wi-Fi, an NTP reachable clock, and actual PM / temperature / humidity sensor drivers.

## Install and configure

```bash
npm install
npm --prefix backend install
npm --prefix simulator install
cp backend/.env.example backend/.env
cp simulator/.env.example simulator/.env
```

Edit `backend/.env`. Set a unique `JWT_SECRET` with at least 32 characters, a strong `SENSOR_ENCRYPTION_KEY`, MongoDB URI, and the allowed frontend origin. The defaults in `backend/.env.example` are local development examples, not production secrets. The root `.env.example` documents Vite settings; Vite reads them from a root `.env` if you need to override local defaults.

Start MongoDB with Docker:

```bash
docker compose up -d mongo
```

Or start the whole stack with Docker Compose:

```bash
docker compose up --build
```

The app is served at `http://localhost:4001`, the API at `http://localhost:6001`, and MongoDB at `mongodb://localhost:27017/breezo_network`.

## Run locally

Run each service in a separate terminal:

```bash
npm run backend
npm run dev
```

Check the backend:

```bash
curl http://localhost:6001/api/health
```

Expected body includes `"success":true` and `"message":"BREEZO API is running"`. `services.database` reports whether MongoDB connected.

## Create the first administrator

Set `BOOTSTRAP_ADMIN_EMAIL` and a strong `BOOTSTRAP_ADMIN_PASSWORD` in `backend/.env`, then run:

```bash
npm run seed:admin
```

Sign in at `/login`. Public registration creates a `VIEWER`. An administrator can promote accounts from **Team access**. Operators can provision and manage their own sensors; admins can manage every node and verify sensors.

## Run a sensor simulator

Register a sensor in **Sensors → Register sensor**. Copy the one-time device key into `simulator/.env`:

```env
SIMULATOR_API_URL=http://localhost:6001/api
SIMULATOR_DEVICE_KEYS=ESP32-001=paste-the-one-time-device-key-here
```

Then run:

```bash
npm run simulate
npm run simulate -- --sensors=10
```

For simulator auto-provisioning, set `SIMULATOR_JWT` to an `ADMIN` or `NODE_OPERATOR` access token. Newly provisioned keys are saved with owner-only file permissions to `simulator/.env`, which is gitignored. Never commit device keys.

## ESP32 reference firmware

Open `esp32/breezo_sensor/breezo_sensor.ino` in Arduino IDE or PlatformIO. Install ArduinoJson and the ESP32 Arduino core. Copy `config.h` settings into the ignored `secrets.h`, set a reachable API host and device key, and flash the board. Sequence numbers persist using ESP32 Preferences; time is synchronized using NTP before reports are signed.

The included `sensor.cpp` generates demonstration measurements. Replace `readSensorValues()` with the sensor drivers and calibration for your actual hardware. Use HTTPS/TLS in deployed environments; the sample local endpoint is plain HTTP for development.

## Solana / Anchor

`blockchain/programs/breezo_rewards/src/lib.rs` defines:

- A one-time config PDA with an admin authority.
- Owner-derived sensor PDAs for register, verify and active-state updates.
- Reward accrual restricted to the admin authority and verified sensors.
- SPL Token / Token-2022 interface transfer from a treasury PDA when an owner claims a recorded balance.

The program is source only until compiled and deployed. Install Anchor 0.30.1 and Solana tools, install blockchain npm dependencies, ensure the provider wallet is on Devnet, then:

```bash
cd blockchain
npm install
mkdir -p target/deploy
solana-keygen new --no-bip39-passphrase --silent --outfile target/deploy/breezo_rewards-keypair.json
anchor keys sync
anchor build
anchor test
```

The generated deploy keypair stays under ignored `blockchain/target/`; back it up securely if you later deploy this program. `anchor keys sync` updates the scaffold ID to that keypair. Deploying requires Devnet SOL and an explicitly initialized authority. The browser wallet view only connects to a wallet and queries its SOL balance; it does not call this program yet. Backend reward credits are a validated off-chain ledger and are not synchronized on chain by this workspace.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` / `npm run frontend` | Vite frontend on port 4001 |
| `npm run backend` | Express API and Socket.IO on port 6001 |
| `npm run seed:admin` | Create or promote the bootstrap administrator |
| `npm run simulate -- --sensors=10` | Send signed readings from 10 simulated nodes |
| `npm run build` | Type-check and build the frontend |
| `npm run test` | Run backend API/domain tests and frontend component rendering tests |
| `npm run blockchain` | Run Anchor local-validator test (requires Anchor and Solana tools) |
| `docker compose up --build` | Start MongoDB, API and frontend |

## Environment variables

See [.env.example](.env.example), [backend/.env.example](backend/.env.example), and [simulator/.env.example](simulator/.env.example). Backend secrets must never use the `VITE_` prefix. `.env` files and ESP32 `secrets.h` are ignored by git.

## API

Endpoint methods, authentication, example bodies and security behavior are documented in [docs/api.md](docs/api.md).

## Deployment

The repository includes [Vercel SPA routing](vercel.json), a [Render API blueprint](render.yaml), and [deployment instructions](docs/deployment.md). Those files prepare the services for hosting; they do not create cloud resources or deploy the Anchor program.

## Security and operational notes

- Device secrets are shown once at provisioning and stored encrypted at rest with AES-256-GCM. Reading payloads are also AES-256-GCM encrypted and HMAC-SHA256 signed. Protect `SENSOR_ENCRYPTION_KEY` and back it up; losing it requires rotating every device key.
- Nonces expire from MongoDB after an hour. Telemetry timestamp tolerance defaults to 30 seconds. ESP32 needs a working clock.
- JWTs are stateless and expire. Logout clears the browser token but does not revoke an already issued token.
- The reward API deliberately responds `501` to claims until the program, token mint, treasury and server signer are configured.
- MongoDB health is shown separately from HTTP health. When MongoDB is disconnected, data routes fail instead of silently inventing persisted records.
- Before public deployment, configure TLS, production secrets, managed MongoDB, monitoring/backups, stricter CORS and rate limits, and an audited wallet-signing/reward service.

## Future work

- Integrate calibrated PM2.5 / PM10 and temperature / humidity hardware sensors.
- Build and deploy the Anchor program, configure a Devnet SPL mint and treasury, and connect backend-confirmed transactions to the reward history.
- Add refresh/revocation tokens, account verification and richer audit history.
- Add device-specific rate limits, key rotation UX, and automated API integration tests against a disposable MongoDB instance.
- Add deployment pipelines and real production screenshots.
# breezo-network
