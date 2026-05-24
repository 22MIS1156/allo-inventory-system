# ReserveFlow Commerce

A production-oriented inventory reservation system for e-commerce checkout flows. The repository now contains:

- a **generated Next.js App Router backend blueprint** under `app/`, `lib/`, and `prisma/`
- an **interactive preview UI** in `src/` that visualizes the same reservation flow for local review in the current build environment

The core goal is preventing oversells when multiple customers try to reserve the same stock at the same time.

## Project overview

Customers can temporarily reserve inventory during checkout for 10 minutes. If the checkout succeeds, the reservation is confirmed and inventory is committed. If the reservation expires or is cancelled, the held units are released back into available stock.

## Architecture

### Data model

- `Product`
- `Warehouse`
- `Inventory`
- `Reservation`

Inventory is modeled per `productId + warehouseId` with a unique composite key.

Available stock is always:

```text
available = totalStock - reservedStock
```

### Application layers

- `prisma/schema.prisma` — relational schema and enum definitions
- `prisma/seed.ts` — deterministic seed data
- `lib/prisma.ts` — Prisma client singleton
- `lib/validation.ts` — Zod request validation
- `lib/reservations.ts` — transaction-safe business logic and expiry cleanup
- `lib/redis.ts` — optional Upstash Redis idempotency cache helpers
- `app/api/**` — Next.js route handlers

## Concurrency strategy

This is the most important part of the system.

### Reservation creation

`POST /api/reservations` uses a PostgreSQL transaction and explicitly locks the matching inventory row before calculating availability.

High-level flow:

1. Start a Prisma transaction.
2. Run `SELECT ... FOR UPDATE` on the `Inventory` row for `(productId, warehouseId)`.
3. Release expired pending reservations for that same row.
4. Recompute available stock using the latest locked values.
5. If stock is insufficient, return **HTTP 409**.
6. Otherwise increment `reservedStock` and create a `PENDING` reservation.

Because the inventory row is locked, two simultaneous requests for the final unit cannot both succeed. One request acquires the lock first, updates `reservedStock`, and commits. The second request waits, then sees no remaining availability and returns `409`.

### Confirm / release

`POST /api/reservations/[id]/confirm` and `POST /api/reservations/[id]/release` lock the reservation row and the related inventory row inside the same transaction so stock adjustments happen exactly once.

## Reservation expiry strategy

The implementation includes **lazy cleanup** via `cleanupExpiredReservations()`.

Cleanup runs before reads and writes, and it:

- finds expired `PENDING` reservations
- marks them `RELEASED`
- decrements the associated `reservedStock`

This is enough to keep the system correct without a worker.

### Optional cron hardening

For Vercel, you can add a cron-triggered cleanup route later if you want expired rows to be released even when traffic is low. The lazy cleanup strategy already keeps reads and writes accurate.

## API documentation

### `GET /api/products`
Returns products with warehouse-level stock availability.

### `GET /api/warehouses`
Returns every warehouse.

### `POST /api/reservations`
Request body:

```json
{
  "productId": "prod-wireless-headset",
  "warehouseId": "wh-sydney",
  "quantity": 1
}
```

Behavior:

- validates with Zod
- locks the inventory row
- releases expired reservations for that row
- returns `409` if there is not enough stock
- otherwise increments `reservedStock`
- creates a `PENDING` reservation with `expiresAt = now + 10 minutes`

### `POST /api/reservations/[id]/confirm`
Behavior:

- returns `410` if expired
- returns success idempotently if already confirmed
- decrements `totalStock`
- decrements `reservedStock`
- updates reservation to `CONFIRMED`

### `POST /api/reservations/[id]/release`
Behavior:

- returns success idempotently if already released
- decrements `reservedStock`
- updates reservation to `RELEASED`

## Environment variables

Create a `.env` file from `.env.example`.

Required variables:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_BASE_URL`

Optional variables:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `CRON_SECRET`

## Local setup

Install dependencies:

```bash
npm install
```

Generate the Prisma client:

```bash
npx prisma generate
```

Create the first migration:

```bash
npx prisma migrate dev --name init
```

Seed the database:

```bash
npx tsx prisma/seed.ts
```

Run the app locally:

```bash
npm run dev
```

## Prisma migration commands

Development:

```bash
npx prisma migrate dev --name init
```

Deploy existing migrations:

```bash
npx prisma migrate deploy
```

Regenerate the client:

```bash
npx prisma generate
```

## Seed data

The seed inserts:

- 4 products
- 2 warehouses
- inventory distribution across both warehouses

## Deployment on Vercel

1. Provision PostgreSQL on Neon or Supabase.
2. Add environment variables in the Vercel dashboard.
3. Run Prisma migrations during deployment or from CI:

```bash
npx prisma migrate deploy
```

4. Optionally configure Upstash Redis for idempotency caching.
5. Deploy the Next.js App Router source.

## Idempotency bonus

`lib/redis.ts` provides optional Upstash Redis helpers for storing responses keyed by `Idempotency-Key`. The reservation route can reuse a cached response when the same request fingerprint is replayed.

## Tradeoffs

- Lazy cleanup is simpler than a dedicated worker and is enough for correctness.
- Row locking is reliable but increases contention on the hottest inventory rows.
- Redis idempotency is optional because database locking already prevents overselling.

## Future improvements

- Add a dedicated Vercel Cron cleanup route
- Persist checkout/customer context on reservations
- Add admin inventory adjustment workflows
- Add audit logging and observability traces
- Add integration tests that fire concurrent reservation requests against PostgreSQL

## Notes for this repository

The current build target for this environment serves the preview app from `src/`. The generated production backend blueprint requested in the prompt lives in the repository under:

- `prisma/`
- `lib/`
- `app/api/`

That structure is intended for direct promotion into a Next.js App Router runtime.
