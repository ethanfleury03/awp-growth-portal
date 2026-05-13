import Link from 'next/link';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

const DEFAULT_GATEWAY_ADMIN_EMAILS = ['ethan@wnyautomation.com'];

function configuredGatewayAdminEmails() {
  return new Set(
    [
      ...DEFAULT_GATEWAY_ADMIN_EMAILS,
      ...(process.env.PORTAL_GATEWAY_ADMIN_EMAILS || process.env.GATEWAY_SUPER_ADMIN_EMAILS || '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ],
  );
}

function gatewayAdminUrl() {
  const base =
    process.env.PORTAL_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_GATEWAY_URL ||
    'https://app.wnyautomation.com';
  return `${base.replace(/\/$/, '')}/admin`;
}

export default async function AccountUnassignedPage() {
  const user = await currentUser().catch(() => null);
  const email =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    null;
  if (email && configuredGatewayAdminEmails().has(email.trim().toLowerCase())) {
    redirect(gatewayAdminUrl());
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-950">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
          Account setup needed
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Your login is not assigned to a client workspace yet.
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          WNY Automation needs to connect your email to a client CRM before you can use the
          portal. If you just created an account, send your login email to your WNY Automation
          contact and we will assign the correct workspace.
        </p>
        {email ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Signed in as <span className="font-medium">{email}</span>
          </div>
        ) : null}
        <Link
          href="/sign-in"
          className="mt-6 inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
