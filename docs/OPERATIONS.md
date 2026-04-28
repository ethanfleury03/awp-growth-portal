# WNY Automation Portal Operations Runbook

This doc describes the production operating model for WNY Automation Portal. Treat it as the single source of truth for on-call, deploys, backups, and incident response.

## Platforms

| Concern | Service | Notes |
|---|---|---|
| Hosting | Vercel | Preview deploys on PRs, production on `main`. |
| Database | Neon Postgres | Separate project per env. PITR enabled. Preview branches per PR. |
| File storage | Cloudflare R2 | Bucket per env. Presigned PUTs only. |
| Auth | Clerk | Webhooks -> `/api/clerk/webhook` -> `portal_users`. |
| Payments | Stripe Connect | Destination charges, per-tenant connected accounts. |
| Email | Resend | Domain verified; bounce/complaint webhooks -> notifications table. |
| SMS | Twilio | STOP handled by inbound webhook. |
| Error tracking | Sentry | `SENTRY_DSN` server+client, tagged with `company_id`. |
| Logs | Axiom or Logtail | Pino JSON shipped via Vercel log drain. |
| Uptime | Better Stack | Probes on `/api/health`, `/api/public/invoice/:token`. |
| Background jobs | Inngest | PDF generation, retries, service-contract materialization. |

## Environment variables

See `.env.example`. Production secrets live in Vercel project settings and are managed by Doppler for parity across local/CI.

## Deploys

1. PR opened -> Vercel creates a preview deployment + a Neon preview branch.
2. CI runs `lint`, `tsc --noEmit`, `vitest`, `drizzle-kit check`, `next build`.
3. Migrations that change schema MUST ship as `drizzle-kit generate` SQL in the PR. `npm run db:migrate` runs as a Vercel "Build Command" predeploy hook against `DATABASE_URL`.
4. Merge to `main` -> production deploy. Post-deploy, Vercel runs the same `db:migrate` against the production Neon branch.

## Backups & restore drill

Neon keeps PITR for 7 days on the free tier, 30 days on paid. To verify, run the quarterly drill:

1. In Neon dashboard, create a restore branch from the main branch at `now() - interval '1 hour'`.
2. Point a staging Vercel deployment at the restore branch's `DATABASE_URL`.
3. `curl https://<staging>/api/health` — should return `{ ok: true, db: 'up' }`.
4. Spot-check a recent invoice and payment in the UI.
5. Delete the restore branch.

Log the drill result in `docs/ops-log.md`.

## Incident response

1. Acknowledge in Better Stack within 5 minutes.
2. Open an incident channel in the team chat (`#inc-<short-id>`).
3. Post the first update to the public status page within 10 minutes.
4. Mitigate first, diagnose second. Rollback strategies:
   - App regressions: redeploy previous Vercel build.
   - Migration regressions: restore from Neon PITR (see drill).
   - Stripe issue: disable new checkouts via feature flag, keep webhooks processing.
5. Post-mortem within 72 hours. Template lives in `docs/postmortem-template.md`.

## On-call expectations

- Primary + secondary rotation, weekly handoff on Mondays 09:00 PT.
- Response SLA: 15 min for P0 (checkout down), 1 hour for P1 (feature broken for one tenant), next business day for P2.
- Quiet hours: 22:00-07:00 local; pager still fires for P0.
