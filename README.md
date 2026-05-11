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
tracked in Git.

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

## Docs

Operational notes live in `docs/`, including receptionist, estimates, Stripe,
database migration, and production readiness runbooks.
