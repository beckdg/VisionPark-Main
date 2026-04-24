# VisionPark Backend

Node.js + MongoDB backend for VisionPark with sessions, parking, operations, realtime forwarding, and AI event ingestion (simulation-ready).

## Quick Start (Docker Compose)

From project root:

```bash
docker-compose up --build
```

Backend API: `http://localhost:4000`

## Local Run (without Docker)

From `backend/`:

```bash
npm install
npm run start
```

Required env vars:

- `NODE_ENV` (`development` | `staging` | `production` | `test`)
- `PORT` (default `4000`)
- `MONGO_URI`
- `MONGO_DB_NAME` (optional)
- `JWT_SECRET` (required in staging/production; test/development use safe defaults if unset)
- `JWT_EXPIRES_IN` (optional, default `1d`)
- `AI_API_KEY` (required for `POST /api/ai/events` and `POST /api/ai/simulate`; staging/production require explicit values)

Auth endpoints:

- `POST /api/auth/register` — `{ "email", "password", "name", "role" }` (`role`: `driver` | `attendant` | `owner` | `admin`)
- `POST /api/auth/login` — `{ "email", "password" }` → `{ "token", "user" }`
- `GET /api/auth/me` — header `Authorization: Bearer <token>`

After `npm run seed`, demo users share password from `SEED_DEMO_PASSWORD` or default `VisionParkDemo!2026` (see seed log).

## Seed Demo Data

From `backend/`:

```bash
npm run seed
```

This creates/upserts:

- demo owner
- demo driver
- demo attendant
- demo lot, zones, spots
- demo reserved/secured sessions

Safe to run multiple times.

## Simulate AI Pipeline

From `backend/`:

```bash
npm run simulate:ai
```

Optional:

- `API_BASE_URL` (default `http://localhost:4000`)
- `SIM_SESSION_ID` (to bind entry/exit to a real session)

Scenario steps:

1. `entry_detected`
2. `mismatch_detected`
3. `exit_detected`

## Health + Metrics

- `GET /health`
- `GET /health/deep`
- `GET /metrics`

`/health/deep` checks:

- Mongo connectivity
- jobs initialization + heartbeat
- realtime initialization + connected clients
- last processed AI event timestamp

`/metrics` returns:

- session counts by state
- spot counts by status
- incidents count
- enforcement count

## Sample API Calls

Create reservation:

```bash
curl -X POST http://localhost:4000/api/sessions/reservations \
  -H "Content-Type: application/json" \
  -d '{"driverId":"<driverId>","lotId":"<lotId>","zoneId":"<zoneId>","spotId":"<spotId>","expiresAt":"2026-12-31T10:00:00.000Z","idempotencyKey":"demo-reserve-1"}'
```

Secure session:

```bash
curl -X POST http://localhost:4000/api/sessions/<sessionId>/secure \
  -H "Content-Type: application/json" \
  -d '{"idempotencyKey":"demo-secure-1"}'
```

AI event:

```bash
curl -X POST http://localhost:4000/api/ai/events \
  -H "Content-Type: application/json" \
  -d '{"eventType":"mismatch_detected","cameraId":"cam-1","timestamp":"2026-01-01T10:00:00.000Z","confidence":0.62,"metadata":{"reason":"plate_mismatch","plate":"UNKNOWN"}}'
```

## Architecture Summary

- **Sessions**: lifecycle authority
- **Parking**: derived spot state authority
- **Operations**: incidents/enforcement/transactions
- **AI ingestion**: validates external AI signals and maps via existing services only
- **Realtime**: forwards domain events to Socket.IO rooms
- **Jobs**: reservation expiry + consistency reconciliation
