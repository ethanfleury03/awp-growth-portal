# WNY Automation Portal Production Readiness

## First Production Setup

1. Deploy the latest `awp-growth-portal` branch to Vercel.
2. Confirm the portal project has the production Neon `DATABASE_URL`.
3. Run migrations against production:
   ```bash
   npm run db:migrate --workspace @wnyautomation/portal
   ```
4. Run the idempotent seed:
   ```bash
   npm run db:seed:production --workspace @wnyautomation/portal
   ```
5. Verify:
   - `/super-admin` loads for the WNY super admin.
   - Tenant detail pages load.
   - Preview workspace shows the tenant branding/modules.
   - `/app` loads for assigned client users.
   - Disabled module URLs show the module-disabled screen.

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
