import Link from 'next/link';

export default function AccountUnassignedPage() {
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
