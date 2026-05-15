# AWP Growth Portal

Client CRM and growth operations portal for the AWP engagement.

## Local Development

```bash
npm ci
npm run dev
```

Open [http://localhost:3003](http://localhost:3003) with your browser to see the result.

## Environment

Copy `.env.example` to `.env.local` for local development and fill in the
service credentials needed for the workflow you are testing. Production
environment variables are managed in Vercel.

When `DATABASE_URL` is not set, local development falls back to SQLite at
`data/plumberos.db`. That runtime database is intentionally ignored and is not
tracked in Git. Hosted production/preview environments must set `DATABASE_URL`;
the app refuses to use SQLite there so client data cannot land on ephemeral
runtime storage.

Production DB = shared WNY Automation platform source of truth. AWP is a client
portal and schema consumer; `wnyautomation-admin` owns shared production Drizzle
migrations. AWP should not generate or apply production migrations for shared
tables such as `companies`, `portal_users`, `user_memberships`, and
`portal_destinations`.

## Useful Commands

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

## Deployment

This repository deploys to the existing Vercel project `wnyautomation-portal`
from the repository root.

When this portal is moved behind the central WNY Automation gateway, configure:

```text
PORTAL_GATEWAY_URL=https://app.wnyautomation.com
PORTAL_GATEWAY_SERVICE_TOKEN=<shared internal token>
PORTAL_GATEWAY_DESTINATION_KEY=awp-growth-portal
```

With those variables present, direct visits to this portal require both a local
portal assignment and a matching gateway assignment.

For deployment verification, call `GET /api/internal/db-info` with
`PORTAL_GATEWAY_SERVICE_TOKEN` or `WNY_INTERNAL_STATUS_TOKEN`. The response
returns only non-secret DB identity fields and expected-table checks.

## Docs

Operational notes live in `docs/`, including receptionist, estimates, Stripe,
database migration, and production readiness runbooks.
