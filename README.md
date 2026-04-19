# 🚗 Kharrazi — SaaS Platform

Production-ready multi-tenant SaaS for Moroccan car rental agencies.

## 📁 Project Structure

```
kharrazi/
├── apps/
│   ├── api/                    # Node.js + Express + TypeScript backend
│   │   ├── src/
│   │   │   ├── config/         # DB, logger, env config
│   │   │   ├── middleware/     # auth, error, validation, tenant
│   │   │   ├── modules/        # auth | cars | clients | reservations | payments | analytics
│   │   │   └── utils/          # ApiError, ApiResponse, jwt helpers
│   │   └── Dockerfile
│   └── web/                    # Next.js 14 App Router frontend
│       ├── app/
│       │   ├── (auth)/login    # Login page
│       │   └── (dashboard)/    # Protected pages: cars, clients, reservations, payments
│       ├── components/         # Layout, UI, page components
│       ├── lib/api/            # Axios client + typed API modules
│       ├── store/              # Zustand auth store
│       └── Dockerfile
├── packages/
│   └── database/               # Prisma schema + seed
│       └── prisma/
│           ├── schema.prisma   # Full multi-tenant schema
│           └── seed.ts         # Demo data (3 agencies, cars, clients, reservations)
├── nginx/nginx.conf            # Reverse proxy config
├── docker-compose.yml          # Full stack: postgres + api + web + nginx
└── .env.example                # All required environment variables
```

## 🚀 Quick Start

### Option A — Docker (recommended, no local Node.js needed)

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Start all services
docker-compose up -d

# 3. Seed demo data (first time only)
docker-compose exec api npx ts-node prisma/seed.ts

# 4. Open the app
open http://localhost          # via nginx
# or http://localhost:3000     # web direct
# or http://localhost:4000/api # api direct
```

### Option B — Local development

```bash
# Prerequisites: Node.js 20+, Yarn 1.x, PostgreSQL 16

# 1. Install dependencies
yarn install

# 2. Copy and configure env
cp .env.example .env
# Edit .env: set DATABASE_URL to your local PostgreSQL

# 3. Generate Prisma client & run migrations
yarn db:generate
yarn db:migrate

# 4. Seed demo data
yarn db:seed

# 5. Start dev servers (api + web in parallel)
yarn dev
```

## 🔐 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@rental.ma | Password123! |
| Agency Admin | manager@automaoclocation.ma | Password123! |
| Employee | employee@automaoclocation.ma | Password123! |
| Accountant | accountant@automaoclocation.ma | Password123! |

## 🌐 Service URLs

| Service | URL |
|---------|-----|
| Web App | http://localhost:3000 |
| API | http://localhost:4000/api |
| API Health | http://localhost:4000/health |
| Prisma Studio | `yarn db:studio` |

## 🧱 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20, Express 4, TypeScript 5 |
| ORM | Prisma 5 + PostgreSQL 16 |
| Auth | JWT (access + refresh token rotation) |
| Frontend | Next.js 14 (App Router), TypeScript |
| UI | Tailwind CSS + Radix UI (ShadCN) |
| State | Zustand + TanStack Query |
| Charts | Recharts |
| Validation | Zod |
| Logging | Pino |
| Container | Docker + nginx |

## 📡 API Endpoints

### Auth
```
POST /api/auth/login          Login
POST /api/auth/register       Register
POST /api/auth/refresh        Refresh tokens
POST /api/auth/logout         Logout
GET  /api/auth/me             Current user
PUT  /api/auth/change-password Change password
```

### Cars
```
GET    /api/cars              List cars (paginated, filterable)
GET    /api/cars/stats        Fleet statistics
GET    /api/cars/:id          Car detail
POST   /api/cars              Create car
PATCH  /api/cars/:id          Update car
DELETE /api/cars/:id          Soft delete car
GET    /api/cars/:id/availability  Check date availability
```

### Clients
```
GET    /api/clients           List clients
GET    /api/clients/stats     Client statistics
GET    /api/clients/:id       Client detail + rental history
POST   /api/clients           Create client
PATCH  /api/clients/:id       Update client (incl. risk score, blacklist)
DELETE /api/clients/:id       Soft delete
```

### Reservations
```
GET    /api/reservations      List (filter by status, date, client, car)
GET    /api/reservations/stats  Reservation statistics
GET    /api/reservations/:id  Detail with payments
POST   /api/reservations      Create reservation (validates availability)
POST   /api/reservations/:id/confirm   Confirm pending reservation
POST   /api/reservations/:id/activate  Hand over car to client
POST   /api/reservations/:id/complete  Return car, finalize
POST   /api/reservations/:id/cancel    Cancel with reason
```

### Payments
```
GET    /api/payments          List payments
GET    /api/payments/summary  Financial summary (week/month/year)
GET    /api/payments/monthly-revenue  Monthly revenue chart data
POST   /api/payments          Record payment
```

### Analytics
```
GET    /api/analytics/dashboard      Full KPI dashboard data
GET    /api/analytics/revenue-chart  Monthly chart by year
```

## 🏗️ Database Schema

- **Agency** — Tenant root entity
- **User** — Staff with role-based access (SUPER_ADMIN, AGENCY_ADMIN, EMPLOYEE, ACCOUNTANT)
- **RefreshToken** — Secure token rotation
- **Car** — Fleet with status, pricing (MAD), maintenance tracking
- **Client** — CIN-based identification, risk scoring, blacklist
- **Reservation** — Full lifecycle (PENDING → CONFIRMED → ACTIVE → COMPLETED)
- **Payment** — Multi-type (deposit, rental, extra, refund) with methods
- **Notification** — Agency-scoped alerts
- **AuditLog** — Full audit trail

## 🐳 Docker Commands

```bash
docker-compose up -d          # Start all services (detached)
docker-compose down           # Stop all services
docker-compose down -v        # Stop + remove volumes (reset data)
docker-compose logs -f api    # Stream API logs
docker-compose logs -f web    # Stream web logs
docker-compose exec api sh    # Shell into API container
docker-compose build --no-cache  # Force rebuild
```

## 🌍 Localization

- Language: **French** (primary UI), Arabic-ready (font configured)
- Currency: **MAD** (Moroccan Dirham) — formatted with `Intl.NumberFormat`
- Timezone: Africa/Casablanca (configure via `TZ` env var if needed)

## 🔒 Security Features

- Helmet.js (HTTP headers hardening)
- CORS with whitelist
- Rate limiting (100 req/15min globally, 10 req/15min for auth)
- JWT with short-lived access tokens (15m) + refresh rotation (7d)
- bcrypt password hashing (12 rounds)
- Zod input validation on all endpoints
- Prisma parameterized queries (SQL injection prevention)
- Non-root Docker user
- Soft deletes (no data loss)
- Multi-tenant isolation (`agencyId` on all queries)
