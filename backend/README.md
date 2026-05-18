# VisionPark Backend

Node.js + Express + MongoDB API for VisionPark: session lifecycle, parking inventory, operations (incidents, enforcement, transactions), AI event ingestion, Chapa payments, file uploads, analytics, and Socket.IO realtime forwarding.

## Quick start

### Docker Compose (from repo root)

```bash
docker compose up --build
```

API: `http://localhost:4000`

### Local development

```bash
npm install
npm run dev          # node --watch src/server.js
npm run seed         # demo users, lot, zones, spots, sessions
```

Default MongoDB URI (development): `mongodb://127.0.0.1:27017/visionpark`

## Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| `dev` | `npm run dev` | Watch mode |
| `start` | `npm start` | Production start |
| `test` | `npm test` | Jest integration tests (`--runInBand`) |
| `seed` | `npm run seed` | Idempotent demo data |
| `simulate:ai` | `npm run simulate:ai` | POST sample AI events |

## Environment variables

Loaded from `backend/.env` (see `src/config/env.js`).

| Variable | Required | Default / notes |
| :--- | :--- | :--- |
| `NODE_ENV` | no | `development` \| `staging` \| `production` \| `test` |
| `PORT` | no | `4000` |
| `MONGO_URI` | staging/prod | Dev: `mongodb://127.0.0.1:27017/visionpark` |
| `MONGO_DB_NAME` | no | `visionpark` (test: `visionpark_test`) |
| `JWT_SECRET` | staging/prod | Dev/test have safe defaults |
| `JWT_EXPIRES_IN` | no | `1d` |
| `AI_API_KEY` | staging/prod | Dev default provided; used on `/api/ai/*` |
| `CORS_ALLOWED_ORIGINS` | no | `*` or comma-separated origins |
| `RESERVATION_EXPIRY_JOB_MS` | no | `15000` |
| `RECONCILIATION_JOB_MS` | no | `30000` |
| `PAYMENT_PENDING_EXPIRY_JOB_MS` | no | `60000` |
| `SEED_DEMO_PASSWORD` | no | `VisionParkDemo!2026` |
| `CLOUDINARY_CLOUD_NAME` | no | Profile/incident media uploads |
| `CLOUDINARY_API_KEY` | no | |
| `CLOUDINARY_API_SECRET` | no | |
| `CHAPA_SECRET_KEY` | no | Payment initialization |
| `CHAPA_PUBLIC_KEY` | no | |
| `CHAPA_BASE_URL` | no | `https://api.chapa.co/v1` |
| `CHAPA_CALLBACK_URL` | no | OAuth-style return URL |
| `CHAPA_RETURN_URL` | no | Browser redirect after pay |
| `CHAPA_WEBHOOK_SECRET` | no | Webhook verification |

## Demo users (after seed)

| Email | Role |
| :--- | :--- |
| `admin@visionpark.demo` | admin |
| `owner@visionpark.demo` | owner |
| `attendant@visionpark.demo` | attendant |
| `driver1@visionpark.demo` | driver |
| `driver2@visionpark.demo` | driver |

Password: `SEED_DEMO_PASSWORD` or `VisionParkDemo!2026`.

## Project structure

```text
src/
├── server.js              HTTP server bootstrap
├── app/
│   ├── app.js             Express app, routes, health/metrics
│   ├── middleware/        Request context, errors, auth
│   └── runtime-state.js   Jobs/realtime/AI heartbeat flags
├── config/                env.js, cloudinary.js
├── database/mongo.js      Mongoose connection
├── common/                errors, logger
├── jobs/                  Reservation expiry, reconciliation, payment pending
├── realtime/              Socket.IO server + domain event router
├── modules/               Feature modules (see below)
└── scripts/               seed.js, simulate-ai.js, repair indexes
tests/
└── integration/           Auth, RBAC, invariants, events, resilience
```

## API overview

All JSON APIs are under `/api` unless noted. Responses use `{ success, data }` or `{ success: false, error: { code, message, details } }`.

### Auth — `/api/auth`

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/register` | — | `{ email, password, name, role }` — `driver` \| `attendant` \| `owner` \| `admin` |
| POST | `/login` | — | Returns `{ token, user }` |
| GET | `/me` | Bearer | Current user |

### Sessions — `/api/sessions`

| Method | Path | Roles | Description |
| :--- | :--- | :--- | :--- |
| POST | `/reservations` | driver, admin | Create reservation |
| POST | `/:sessionId/secure` | attendant-scoped | Mark secured |
| POST | `/:sessionId/expire` | attendant, admin | Force expire |
| POST | `/:sessionId/close` | driver/attendant/admin | Close session |
| GET | `/me/active` | driver, admin | Active session |
| GET | `/me`, `/my` | driver | Session history |
| GET | `/:sessionId` | scoped | Session detail |
| GET | `/:sessionId/exit-eligibility` | scoped | Exit checks |
| POST | `/:sessionId/exit-validate` | scoped | Physical exit validation |
| POST | `/:sessionId/exit-override` | attendant, admin | Manual override |

### Parking — `/api/parking`

| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/public/lots` | Public lot list (guest map) |
| GET | `/lots`, `/zones`, `/spots` | Authenticated inventory |
| POST/PATCH/DELETE | `/lots`, `/zones`, `/spots` | Owner/admin CRUD |
| PATCH | `/spots/:spotId/block` | Block spot (attendant/admin) |
| POST | `/spots/:spotId/derive-status` | Recompute spot status |

### Operations — `/api/operations`

| Prefix | Description |
| :--- | :--- |
| `/incidents` | Create, status transitions, get by id |
| `/enforcements` | Create, clear, transition, spot block/unblock |
| `/transactions` | POS/financial transactions |

### AI — `/api/ai`

Requires `AI_API_KEY` header (not JWT).

| Method | Path | Description |
| :--- | :--- | :--- |
| POST | `/events` | Ingest camera/YOLO events |
| POST | `/simulate` | Dev simulation helper |

Run `npm run simulate:ai` for a scripted entry → mismatch → exit flow. Optional: `API_BASE_URL`, `SIM_SESSION_ID`.

### Users — `/api/users`

| Method | Path | Roles |
| :--- | :--- | :--- |
| POST | `/owners` | admin |
| PATCH | `/owners/me` | owner |
| PATCH | `/drivers/me` | driver |
| POST | `/attendants` | owner |
| GET | `/attendants/mine` | owner |
| PATCH/DELETE | `/attendants/:attendantId` | owner |
| GET | `/:id` | self or admin |

### Analytics — `/api/analytics`

| GET | Path | Role |
| :--- | :--- | :--- |
| `/owner/dashboard` | owner |
| `/owner/occupancy` | owner |
| `/owner/revenue` | owner |
| `/owner/recent-activity` | owner |

### Finance — `/api`

| GET | Path | Role |
| :--- | :--- | :--- |
| `/transactions` | owner |
| `/reports/revenue` | owner |

### Owner operations — `/api/owner`

| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/operations/incidents` | Owner incident inbox |
| PATCH | `/operations/incidents/:incidentId/status` | Update status |

### Attendant — `/api/attendant`

| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/live-grid` | Occupancy grid |
| POST | `/spots/:spotId/instruct-leave` | De-escalation flag |
| GET/POST | `/ai-exceptions`, `/:id/resolve` | AI exception queue |
| POST/GET | `/walkup/checkin`, `/walkup/recent`, receipts | Walk-up POS |
| GET/POST | `/incidents`, `/incidents/recent` | Incident logging |

### Pricing — `/api/pricing`

| GET | `/vehicle-categories` | owner, admin |
| GET/PUT | `/config` | Rate matrix |

### Payments — `/api/payments/chapa`

| Method | Path | Description |
| :--- | :--- | :--- |
| POST | `/initialize` | driver — start Chapa checkout |
| GET | `/callback` | Chapa redirect handler |
| POST | `/webhook` | Chapa webhook |
| GET | `/verify/:tx_ref` | driver — verify payment |
| GET | `/debug/:tx_ref` | admin |

### Uploads — `/api/uploads`

| Method | Path | Description |
| :--- | :--- | :--- |
| POST | `/profile-image` | Current user avatar |
| POST | `/users/:userId/profile-image` | Admin/owner upload |
| POST | `/incidents/:incidentId/evidence` | Up to 5 files |
| DELETE | `/` | Remove media |

### Health (no `/api` prefix)

| GET | Description |
| :--- | :--- |
| `/health` | Liveness + requestId |
| `/health/deep` | Mongo, jobs heartbeat, realtime clients, last AI event |
| `/metrics` | Aggregated session, spot, incident, enforcement counts |

## Architecture

```text
HTTP Request
    → cors + json + requestContext
    → route module (controller → service)
    → MongoDB models
    → domainEventBus
         → realtime/event-router → Socket.IO rooms (by role/user)
         → background jobs (reconciliation)
```

**Authority model**

- **Sessions** own the parking session state machine.
- **Parking** derives spot status from sessions and operations.
- **Operations** handle incidents, enforcements, and ledger transactions.
- **AI ingestion** validates external events and delegates to existing services only (no parallel state).

## Background jobs

| Job | Default interval | Purpose |
| :--- | :--- | :--- |
| Reservation expiry | 15s | Expire unpaid/expired reservations |
| Reconciliation | 30s | Session/spot consistency audit |
| Payment pending expiry | 60s | Clear stale pending payments |

## Realtime (Socket.IO)

- Attached to the same HTTP server as Express.
- Auth: JWT via `handshake.auth.token`, query `token`, or `Authorization: Bearer`.
- Domain events from `operations/shared/domain-events` are routed to role-specific rooms.

## Testing

```bash
npm test
```

Integration tests cover auth, RBAC, core invariants, event contracts, and system resilience. Tests use `NODE_ENV=test` and `visionpark_test` database.

## Sample curl

**Login**

```bash
curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"driver1@visionpark.demo","password":"VisionParkDemo!2026"}'
```

**Reserve** (use `token` and ids from seed)

```bash
curl -X POST http://localhost:4000/api/sessions/reservations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"driverId":"<driverId>","lotId":"<lotId>","zoneId":"<zoneId>","spotId":"<spotId>","expiresAt":"2026-12-31T10:00:00.000Z","idempotencyKey":"demo-1"}'
```

**AI event**

```bash
curl -X POST http://localhost:4000/api/ai/events \
  -H "Content-Type: application/json" \
  -H "x-api-key: <AI_API_KEY>" \
  -d '{"eventType":"mismatch_detected","cameraId":"cam-1","timestamp":"2026-01-01T10:00:00.000Z","confidence":0.62,"metadata":{"reason":"plate_mismatch","plate":"UNKNOWN"}}'
```

## Manual verification checklist

1. `npm run seed` — confirm demo users in log output.
2. Login per role; save Bearer tokens.
3. Owner: create lot → zone → spot (`POST /api/parking/*`).
4. Driver: `POST /api/sessions/reservations` (body `driverId` must match token user).
5. Attendant: `POST /api/sessions/:id/secure`.
6. Attendant: `POST /api/operations/enforcements` if testing enforcement.
7. Driver or admin: `POST /api/sessions/:id/close`.
8. `GET /health/deep` and `GET /metrics` — confirm healthy/degraded state.

## Related docs

- [Root README](../README.md) — full-stack quick start
- [Frontend README](../frontend/README.md) — UI routes and API client
