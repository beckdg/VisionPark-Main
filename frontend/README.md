# VisionPark Frontend

Premium, role-based parking management UI built with React 19 and Vite. The app routes authenticated users to tailored dashboards (driver, owner, attendant, admin) and exposes a public guest map at `/`.

## Tech stack

| Package | Version | Role |
| :--- | :--- | :--- |
| React / React DOM | 19.2 | UI |
| React Router DOM | 7.13 | Routing, protected routes |
| Vite | 7.3 | Dev server and build |
| Tailwind CSS | 3.4 | Styling |
| Leaflet / React-Leaflet | 1.9 / 5.0 | Maps |
| Recharts | 3.8 | Owner/admin charts |
| Radix UI, clsx, tailwind-merge | — | UI primitives |
| pdf-lib | 1.17 | Driver receipt PDFs |
| Lucide React | 0.575 | Icons |

Path alias: `@` → `src/` (see `vite.config.js`).

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle
npm run preview  # preview production build
npm run lint
```

**Backend required** for auth, parking, sessions, payments, and most owner/attendant flows. Start the API on port `4000` before logging in.

Configure the API base URL in `src/api/apiClient.js` (`BASE_URL`, default `http://localhost:4000/api`).

## Authentication

- `AuthContext` stores JWT in `localStorage` as `accessToken` and user JSON as `user`.
- `ProtectedRoute` gates `/driver`, `/owner`, `/attendant`, and `/admin` by role.
- Login: `POST /api/auth/login` via `apiClient`; bootstrap calls `GET /api/auth/me`.
- Logout clears `accessToken`, `user`, and all `vp_*` keys except `vp_theme`.

Public routes: `/`, `/login`, `/signup`, `/forgot-password`, `/privacy-policy`, `/admin/login` (admin login reuses `LoginRoute` with role redirect).

## Routes

| Path | Role | Page |
| :--- | :--- | :--- |
| `/` | guest / redirect | `GuestMap` or role home |
| `/driver/map` | driver | Find & reserve spots |
| `/driver/session` | driver | Active session timer |
| `/driver/history` | driver | Past sessions & receipts |
| `/driver/profile` | driver | Profile & vehicle |
| `/payment/success` | driver | Chapa return handler |
| `/owner/dashboard` | owner | Live operations summary |
| `/owner/parking` | owner | Lots, zones, spots |
| `/owner/attendants` | owner | Staff management |
| `/owner/operations` | owner | Incidents & enforcement feed |
| `/owner/analytics` | owner | Utilization charts |
| `/owner/finance` | owner | Revenue reports |
| `/owner/pricing` | owner | Rate matrix |
| `/owner/payout` | owner | Payout accounts |
| `/owner/profile` | owner | Business profile |
| `/attendant/dashboard` | attendant | Live grid |
| `/attendant/exceptions` | attendant | AI exception queue |
| `/attendant/pos` | attendant | Walk-up POS |
| `/attendant/overstays` | attendant | Overstay enforcement |
| `/attendant/enforcement` | attendant | Debt radar |
| `/attendant/incidents` | attendant | Incident logger |
| `/attendant/z-report` | attendant | Shift close |
| `/attendant/profile` | attendant | Read-only staff card |
| `/admin/dashboard` | admin | Platform overview |
| `/admin/platform-analytics` | admin | AI/infra telemetry |
| `/admin/network-health` | admin | Edge node map |
| `/admin/owner-account` | admin | Operator account |
| `/admin/session-manager` | admin | Active sessions |
| `/admin/audit-log` | admin | Audit trail |
| `/admin/payment-gateway` | admin | Gateway config |
| `/admin/backup-recovery` | admin | Backup/restore |
| `/admin/alert-thresholds` | admin | Alert rules |
| `/admin/system-config` | admin | Environment settings |
| `/admin/profile` | admin | Admin identity |

## Project structure

```text
src/
├── App.jsx                 Route tree and layouts
├── main.jsx                Mount + providers
├── api/
│   └── apiClient.js        JWT-aware fetch wrapper
├── context/
│   ├── AuthContext.jsx     Login, logout, /auth/me bootstrap
│   ├── ThemeContext.jsx    Light/dark/system (vp_theme)
│   └── ScrollContext.jsx   Shared scroll behavior
├── components/
│   ├── layout/             Header, AdminHeader
│   └── ui/                 GlassCard, Logo, StatusBadge, Radix widgets
├── shared/
│   ├── auth/               Login, signup, forgot password, ProtectedRoute
│   └── pages/              PrivacyPolicy
├── driver/                 Map, session, history, profile, PaymentSuccess
├── owner/                  Dashboard, parking, finance, pricing, …
├── attendant/              LiveGrid, POS, overstays, enforcement, incidents
├── admin/                  Platform admin pages + AdminLayout
├── guest/pages/GuestMap.jsx
├── lib/utils.js            cn() helper
└── utils/                  resolveDriverProfilePhoto, PDF helpers
```

## API integration

Pages that call the backend use `apiClient` (`get`, `post`, `put`, `patch`, `delete`, `postFormData`). Examples:

| Area | Typical endpoints |
| :--- | :--- |
| Auth | `/auth/login`, `/auth/me`, `/auth/register` |
| Parking | `/parking/public/lots`, `/parking/lots`, zones, spots |
| Sessions | `/sessions/reservations`, `/sessions/me/active`, secure/close |
| Payments | `/payments/chapa/initialize`, verify |
| Owner | `/analytics/owner/*`, `/api/transactions`, pricing `/pricing/config` |
| Attendant | `/attendant/live-grid`, walkup, incidents, ai-exceptions |
| Uploads | `/uploads/profile-image`, incident evidence |

Admin-only and mock-heavy screens (audit log, backup, session manager, network health) may still use in-memory demo data.

## LocalStorage reference

| Key | Purpose |
| :--- | :--- |
| `accessToken` | JWT from backend login |
| `user` | Serialized user from `/auth/me` |
| `vp_theme` | `light` / `dark` / `system` |
| `vp_driver_*` | Driver profile cache (name, email, phone, vehicle, plate, payment, photo) |
| `vp_session_*` | Session UI state (state, area, spot, timestamps) — synced with API where integrated |
| `vp_owner_data` | Owner profile cache + layout sync via `vp_owner_profile_updated` |
| `vp_debt_radar` | Enforcement page debt list (local + API hybrid) |
| `vp_admin_*` | Admin profile display cache (name, email, avatar, 2FA flag) |

Custom events (`vp_profile_updated`, `vp_owner_profile_updated`, `vp_session_changed`, etc.) refresh layouts without reload.

## Module highlights

### Driver

- **DriverMap** — Leaflet map, Haversine routing, reservation flow, Chapa payment init, vehicle compatibility checks.
- **ActiveSession** — Reserved → Secured → receipt states; background notification window for expiry warnings.
- **DriverHistory** — Session list from API; receipt modal and PDF export.
- **DriverProfile** — Profile PATCH via API; optional WebRTC avatar; Ethiopian phone/plate validation.
- **PaymentSuccess** — Handles Chapa return and verifies payment.

### Owner

- **Dashboard / Analytics / FinancialReports** — Charts fed by `/analytics/owner/*` and finance routes.
- **ParkingManagement** — CRUD for lots, zones, spots via `/parking/*`.
- **AttendantManagement** — Staff CRUD via `/users/attendants`.
- **Operations** — Owner incident feed from `/owner/operations/incidents`.
- **PricingSettings** — `/pricing/config` and vehicle categories.

### Attendant

- **LiveGrid** — `/attendant/live-grid`; instruct-leave workflow.
- **AIExceptions** — List/resolve via `/attendant/ai-exceptions`.
- **WalkUpPOS** — Walk-up check-in and receipts.
- **Incidents** — Create/list incidents (component: `IncidentLogger`).
- **Enforcement** — Debt radar (component: `DebtEnforcement`); uses `vp_debt_radar` locally.
- **ZReport** — Blind close shift reconciliation (demo ledger).

### Admin

- **Dashboard, PlatformAnalytics, NetworkHealth** — Operational and AI telemetry (mixed API/mock).
- **OwnerAccount** — Platform operator setup via `/users/owners`.
- **SystemConfig, PaymentGateway, BackupRecovery, AlertThresholds** — Configuration UIs (mostly simulated actions).

## Layouts

| Layout | Theme | Notes |
| :--- | :--- | :--- |
| `DriverLayout` | Emerald | Mobile-first; bottom nav; `ScrollContext` |
| `OwnerLayout` | Emerald | Sidebar; listens for owner profile events |
| `AttendantLayout` | Emerald | Tablet-oriented; route-change drawer close |
| `AdminLayout` | Indigo | Toast portal; admin profile sync |

## Development notes

- Vite dev server binds `0.0.0.0:5173` with HMR `clientPort: 443` for GitHub Codespaces proxies (`allowedHosts: 'all'`).
- ESLint: `npm run lint`.
- Some pages blend API data with `localStorage` or mock fixtures during incremental backend rollout.

## Related docs

- [Root README](../README.md) — monorepo setup and architecture
- [Backend README](../backend/README.md) — API reference and environment variables
