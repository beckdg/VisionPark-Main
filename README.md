# VisionPark

VisionPark is an AI-assisted parking management platform with role-specific experiences for **drivers**, **lot owners**, **attendants**, and **system administrators**. The repository is a monorepo containing a React frontend and a Node.js + MongoDB backend with realtime updates, background jobs, and Chapa payment integration.

## Repository layout

```text
VisionPark/
├── frontend/          React + Vite SPA (port 5173)
├── backend/           Express API + Socket.IO + MongoDB (port 4000)
├── postman/           API collections, environments, and flows
├── docker-compose.yml MongoDB + API (frontend runs locally)
└── LICENSE            MIT
```

| Path | Description |
| :--- | :--- |
| [frontend/README.md](frontend/README.md) | UI modules, routing, API client, localStorage keys |
| [backend/README.md](backend/README.md) | API surface, env vars, jobs, seeding, tests |

## Architecture

```text
┌─────────────┐     REST + JWT      ┌──────────────────┐
│   React     │ ──────────────────► │  Express API     │
│  (Vite)     │     Socket.IO       │  (Node.js)       │
└─────────────┘ ◄────────────────── └────────┬─────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    ▼                          ▼                          ▼
              ┌──────────┐              ┌────────────┐            ┌─────────────┐
              │ MongoDB  │              │ Background │            │ Chapa /     │
              │          │              │ jobs       │            │ Cloudinary  │
              └──────────┘              └────────────┘            └─────────────┘
```

**Domain boundaries (backend)**

- **Sessions** — reservation → secured → closed lifecycle
- **Parking** — lots, zones, spots; derived spot status
- **Operations** — incidents, enforcements, transactions
- **AI ingestion** — external camera/YOLO events mapped into domain services
- **Realtime** — domain events forwarded to Socket.IO rooms by role
- **Payments** — Chapa initialize, callback, webhook, verify

## Prerequisites

- **Node.js** 18+ (20+ recommended)
- **npm**
- **MongoDB** 7 (local install or via Docker)
- Optional: **Docker** and **Docker Compose** for API + database only

## Quick start (full stack)

### 1. Backend + database (Docker)

From the project root:

```bash
docker compose up --build
```

API: `http://localhost:4000`  
MongoDB: `localhost:27017`

### 2. Backend (local, without Docker)

```bash
cd backend
npm install
# Ensure MongoDB is running; defaults use mongodb://127.0.0.1:27017/visionpark
npm run dev
npm run seed
```

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`  
The frontend expects the API at `http://localhost:4000/api` (see `frontend/src/api/apiClient.js`).

### 4. Demo users (after seed)

| Role | Email | Password |
| :--- | :--- | :--- |
| Admin | `admin@visionpark.demo` | `VisionParkDemo!2026` (or `SEED_DEMO_PASSWORD`) |
| Owner | `owner@visionpark.demo` | same |
| Attendant | `attendant@visionpark.demo` | same |
| Driver | `driver1@visionpark.demo`, `driver2@visionpark.demo` | same |

## Health checks

| Endpoint | Purpose |
| :--- | :--- |
| `GET /health` | Liveness |
| `GET /health/deep` | Mongo, jobs, realtime, last AI event |
| `GET /metrics` | Session/spot/incident/enforcement counts |

## Postman

The `postman/` directory holds workspace collections, environments, and flows for exercising the API without the UI.

## Scripts (root)

The root `package.json` only carries shared dev tooling (Tailwind/Jest). Run app scripts from `frontend/` or `backend/`.

## License

MIT — see [LICENSE](LICENSE).
