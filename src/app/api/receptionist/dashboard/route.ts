import { NextResponse } from 'next/server';
import { receptionistService } from '@/lib/receptionist/service';
import { getAppBaseUrl } from '@/lib/receptionist/receptionist-live';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function GET() {
  try {
    const stats = await receptionistService.dashboardStats();
    const { calls, total } = await receptionistService.listCalls(1, 12);
    const settings = await receptionistService.getSettings();
    const integration = {
      providerType: settings.provider_type,
      retellReady: Boolean(
        process.env.RETELL_API_KEY &&
          (settings.retell_agent_id?.trim() || process.env.RETELL_AGENT_ID),
      ),
      twilioReady: Boolean(
        process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_ACCOUNT_SID,
      ),
      toolSecretSet: Boolean(process.env.RETELL_TOOL_SHARED_SECRET),
      appBaseUrl: getAppBaseUrl(),
      voiceWebhookPath: '/api/receptionist/providers/twilio/voice',
      retellWebhookPath: '/api/receptionist/providers/retell/webhook',
    };
    return NextResponse.json({ stats, recentCalls: calls, recentTotal: total, integration });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
