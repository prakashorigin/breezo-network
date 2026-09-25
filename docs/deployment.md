# Deployment guide

This workspace includes deployment configuration, but does not deploy or configure external accounts for you.

## Frontend on Vercel

Import the repository into Vercel and keep the project root at the repository root. `vercel.json` builds the Vite app into `dist` and routes direct page visits back to the SPA entry point.

Set these build environment values in Vercel:

```env
VITE_API_URL=https://YOUR_API_HOST/api
VITE_SOCKET_URL=https://YOUR_API_HOST
VITE_SOLANA_NETWORK=devnet
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
```

These `VITE_` values are public browser configuration. Never put API signing secrets, device keys, JWT secrets, or wallet private keys in them.

## API on Render

`render.yaml` defines a Docker web service using `backend/Dockerfile` and `/api/health`. Connect the Git repository as a Render Blueprint, then supply the required secret values:

- `MONGO_URI`: MongoDB Atlas connection string with a restricted database user.
- `JWT_SECRET`: at least 32 random characters.
- `SENSOR_ENCRYPTION_KEY`: at least 32 random characters. Preserve this value; changing it makes provisioned device keys unreadable.
- `CLIENT_URL`: exact Vercel origin, such as `https://breezo.example`.
- `SOLANA_PROGRAM_ID` and `SOLANA_REWARD_MINT`: leave empty until a Devnet program and mint exist.

Allow the Render service's outbound addresses in MongoDB Atlas, use TLS in the database URI, and verify Render reports `/api/health` as healthy. The health response also includes MongoDB state; a live HTTP process with a disconnected database is not ready for sensor ingestion.

After the API is online, create the first administrator from the Render Shell with a one-command environment:

```bash
BOOTSTRAP_ADMIN_EMAIL=admin@example.com BOOTSTRAP_ADMIN_PASSWORD='use-a-unique-long-password' npm run seed:admin
```

Sign in and remove any temporary credentials from the service environment.

Confirm browser API requests pass CORS, then open a dashboard page and verify the Socket.IO transport upgrades to WebSocket. Set `CLIENT_URL` to the frontend origin exactly; do not use a wildcard for a credentialed browser deployment.

## Database and secrets

Use a managed MongoDB database with backups, TLS, least-privilege credentials, and network allowlisting. Store production secrets in the hosting provider's secret store. Keep the stable `SENSOR_ENCRYPTION_KEY` backed up separately with restricted access.

## Solana Devnet

Deploy the Anchor program and create/fund the SPL treasury separately after the program has been reviewed and tested. Update the frontend's public cluster/RPC configuration and backend program/mint IDs afterward. The current backend does not sign or submit Anchor transactions, so its contribution records remain off-chain and its claim API returns `501`. Do not enable claims until a server-side transaction service, treasury authority, and transaction confirmation flow are configured.
