# Database Migration: SQLite → Neon Postgres

WNY Automation Portal ships with a dual-driver `sql` shim in `src/lib/db.ts` so existing
route handlers work unchanged against either backend:

- `DATABASE_URL` unset → **SQLite** via `better-sqlite3` (default for dev/test).
- `DATABASE_URL` set → **Neon Postgres** via `@neondatabase/serverless` + `pg`.

The canonical schema lives in `src/db/schema/**` (Drizzle ORM). The SQLite
schema at `data/schema.sqlite.sql` is retained for local dev only and will be
removed once all environments are on Neon.

## Neon branch layout (recommended)

| Environment | Neon branch | Consumer                                  |
| ----------- | ----------- | ----------------------------------------- |
| `dev`       | `dev`       | Local developer machines                  |
| `staging`   | `preview`   | Vercel preview deploys, PR branches       |
| `prod`      | `main`      | Vercel production                         |

Use Neon's **branching** feature (copy-on-write) to create `preview` off of
`main` so preview deploys exercise production-shaped data safely. Configure
`DATABASE_URL` per environment in Vercel / Doppler.

## One-time migration

```bash
# 1. Apply Drizzle-generated schema + RLS policies to the target Neon branch
psql "$DATABASE_URL" -f drizzle/0000_fuzzy_thunderbolt_ross.sql
psql "$DATABASE_URL" -f drizzle/0001_rls.sql

# 2. Copy data from local SQLite into Postgres
tsx scripts/migrate-sqlite-to-postgres.ts
```

The migration script respects FK order and runs inside
`SET LOCAL app.role = 'super_admin'` so RLS policies are bypassed for seeding.

## Tenant scoping at the DB layer

All tenant-owned tables (anything with a `company_id`) have RLS enabled. The
app talks to Postgres through `withTenant(companyId, fn)` which opens a
transaction and runs `SET LOCAL app.company_id = '<uuid>'` before executing
queries. Privileged code paths (platform admin, data migration) use
`withSuperAdmin(fn)` which sets `app.role = 'super_admin'` to bypass RLS.

Never call `getDb()` from request-handling code — always go through
`withTenant` to guarantee tenant isolation even if an application-layer filter
is accidentally dropped.

## Generating future migrations

```bash
# Edit src/db/schema/**.ts, then:
npm run db:generate     # drizzle-kit generate
npm run db:migrate      # drizzle-kit migrate (staging first!)
```

RLS changes live in hand-written `drizzle/XXXX_rls_*.sql` files since
`drizzle-kit` does not yet generate RLS policies.
