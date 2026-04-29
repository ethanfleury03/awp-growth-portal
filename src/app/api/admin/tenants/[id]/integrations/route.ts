import { NextResponse } from 'next/server';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  await params;

  return NextResponse.json({
    integrations: [
      {
        key: 'clerk',
        label: 'Clerk auth',
        configured: Boolean(process.env.CLERK_SECRET_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
      },
      {
        key: 'stripe',
        label: 'Stripe payments',
        configured: Boolean(process.env.STRIPE_SECRET_KEY),
      },
      {
        key: 'twilio',
        label: 'Twilio SMS',
        configured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      },
      {
        key: 'retell',
        label: 'Retell receptionist',
        configured: Boolean(process.env.RETELL_API_KEY),
      },
      {
        key: 'r2',
        label: 'R2 uploads',
        configured: Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY),
      },
      {
        key: 'n8n',
        label: 'n8n lead webhook',
        configured: Boolean(process.env.N8N_LEAD_WEBHOOK_URL),
      },
    ],
  });
}
