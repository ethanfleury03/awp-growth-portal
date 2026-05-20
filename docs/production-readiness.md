# WNY Automation Portal Production Readiness

## Launch Runbook

1. Deploy the latest `awp-growth-portal` branch to Vercel.
2. Confirm Vercel env vars are set for both projects:
   - portal: Clerk, Neon `DATABASE_URL`, app URLs, Stripe, Twilio, Retell, Sentry, and optional R2.
   - portal gateway: shared Clerk keys, Neon `DATABASE_URL`, `GATEWAY_INTERNAL_ACCESS_TOKEN`, `GATEWAY_SUPER_ADMIN_EMAILS`, and destination seed values.
   - marketing: `DATABASE_URL`, `BLOG_API_TOKEN`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CLIENT_LOGIN_PATH`, `NEXT_PUBLIC_CLIENT_GATEWAY_SIGN_IN_URL`, lead webhook, and analytics.
3. Confirm domains:
   - `https://wnyautomation.com`
   - `https://www.wnyautomation.com`
   - `https://app.wnyautomation.com` for the gateway.
   - `https://awp.wnyautomation.com` for the AWP portal.
4. Run migrations against production:
   ```bash
   npm run db:migrate --workspace @wnyautomation/portal
   ```
5. Run the idempotent seed:
   ```bash
   npm run db:seed:production --workspace @wnyautomation/portal
   ```
6. Configure Clerk production:
   - production publishable/secret keys in Vercel
   - allowed origins include `https://app.wnyautomation.com` and client portal origins such as `https://awp.wnyautomation.com`
   - sign-in/sign-up redirects point to the app domain
   - Google sign-in enabled if clients will use Google
   - Clerk webhooks point to the gateway and any client portal apps that need local user sync.
7. Configure provider webhooks:
   - Stripe: `https://awp.wnyautomation.com/api/stripe/webhook`
   - Twilio voice/status: AWP portal receptionist webhook URLs
   - Retell webhook/functions: AWP portal receptionist provider URLs
8. Verify:
   - `/super-admin` loads for the WNY super admin.
   - Tenant detail pages load.
   - Preview workspace shows the tenant branding/modules.
   - `https://app.wnyautomation.com/launch` sends assigned client users to the correct portal.
   - `/app` loads for assigned AWP client users after gateway access is configured.
   - Disabled module URLs show the module-disabled screen.
   - `/api/health` returns `ok: true` and `db: "up"`.
   - `/tickets` loads for an assigned client user and a test ticket creates successfully.

## Database & Backup Requirements

- Production source of truth: Neon Postgres, not SQLite.
- Vercel production and preview environments must set `DATABASE_URL`; the app
  refuses to use SQLite in hosted runtimes.
- Use a Neon pooled connection string for runtime `DATABASE_URL`.
- Set `DATABASE_DIRECT_URL` for Drizzle migrations and other admin tasks when
  available.
- Keep production and preview on separate Neon branches. Preview must never
  write to the production branch.
- Before any migration, seed, import, or bulk edit in production, create a named
  Neon snapshot/restore point and record the timestamp in the deployment notes.
- Enable scheduled snapshots/backups with a retention window appropriate for
  the client contract. Daily snapshots plus point-in-time restore is the minimum
  launch posture.
- Do a restore drill before go-live: restore the latest production-like snapshot
  to a non-production branch, point a preview deploy at it, and confirm login,
  CRM list/detail pages, estimates, invoices, and `/api/health`.
- Attachments live outside Postgres when R2 is enabled. Confirm R2 bucket
  lifecycle, access keys, and recovery process separately from database backup.

## Go / No-Go Checklist

- Super admin login works with the production Clerk app.
- Client admin login works and lands in the correct tenant.
- Client Login from `wnyautomation.com/client-login` opens the gateway sign-in and then launches the assigned portal.
- A brand-new unassigned login lands on `/account-unassigned`.
- The unassigned login appears in `/super-admin` and can be assigned.
- Core CRM pages load: dashboard, leads, customers, estimates, invoices.
- Tickets load, save, and remain scoped to the signed-in tenant.
- `DISCORD_TICKETS_WEBHOOK_URL` is configured if new-ticket Discord alerts are expected.
- Disabled modules are hidden and direct URLs are blocked.
- Sentry/logging env vars are configured.
- Gateway login/webhook URLs use `app.wnyautomation.com`; AWP Stripe, Twilio, and Retell webhook URLs use `awp.wnyautomation.com`.
- `/api/admin/system-health` shows no unexpected missing required service categories.

## Seed Environment Overrides

The production seed defaults are safe placeholders except Ethan's super-admin email.
Override these as needed before running:

```bash
SEED_WNY_COMPANY_NAME="WNY Automation"
SEED_WNY_COMPANY_EMAIL="hello@wnyautomation.com"
SEED_SUPER_ADMIN_EMAIL="ethan.fleuryy@gmail.com"
SEED_CLIENT_COMPANY_NAME="Client Name"
SEED_CLIENT_COMPANY_EMAIL="client@example.com"
SEED_CLIENT_ADMIN_EMAIL="client.admin@example.com"
SEED_CLIENT_INDUSTRY="generic"
```

## Manual Admin Smoke Checklist

- Create a tenant from `/super-admin`.
- Assign an unassigned user to that tenant.
- Toggle a module off and confirm its direct URL is blocked.
- Toggle the module on and confirm it loads again.
- Save branding and confirm the sidebar/workspace preview reflects it.
- Add a custom field and pipeline stage, save, refresh, and confirm they persist.
- Confirm audit events appear after tenant/user/module/CRM changes.

## First Client Acceptance Checklist

- Client can sign in without seeing Clerk development mode.
- Client can create a lead and find it again.
- Client can create or edit a customer.
- Client can create an estimate.
- Client can create an invoice or see a clear configuration message if payments are not ready.
- Client can create a ticket, open it again, and add a reply.
- Client can log out and sign back in.
- WNY super admin can see client activity in tenant audit/health views.

## Tenant API Classification

- Super-admin APIs: `/api/admin/**`; must require `super_admin`.
- Company-scoped internal APIs: leads, customers, jobs, estimates, invoices, dispatch, reports, attachments, AI assistant, settings, team, service contracts; must require tenant auth and filter by `company_id`.
- Module-scoped APIs: same as company-scoped where feature modules apply; must use module guards or have an explicit reason not to.
- Public token APIs: `/api/public/**`, `/api/public/estimate/**`, `/api/public/invoice/**`; must rely on unguessable tokens and rate limits.
- Provider webhooks: Clerk, Stripe, Twilio, Retell; must verify provider signatures/secrets and must not rely on user sessions.

## Recovery Notes

- Neon backups are the source of truth for database recovery. Before destructive data work, create or confirm a recent restore point.
- Restore into a non-production branch first whenever the incident allows it;
  inspect the recovered data before swapping production traffic or connection
  strings.
- For a broken deploy, roll back in Vercel first, then inspect `/api/health`, `/api/admin/system-health`, Vercel logs, and Sentry.
- For stuck webhooks, inspect `/super-admin/webhook-failures` and provider dashboards before replaying events.
- If auth assignment breaks, do not manually assign unknown users to arbitrary tenants; use the unassigned-user admin flow.
