/**
 * Provider boundary for mock vs Retell/Twilio. Runtime orchestration lives in
 * `receptionist-live.ts`, `repository.ts`, and `service.ts`; this documents the intent.
 */
export type ReceptionistProviderName = 'mock' | 'retell';

export interface ReceptionistProviderContract {
  getProviderName(): ReceptionistProviderName;
  /** Mock-only: existing `/api/receptionist/mock/*` flows. */
  startMockCall?(scenarioId: string): Promise<unknown>;
  /** Twilio voice webhook: register with Retell, return TwiML. */
  handleInboundTelephony?(input: {
    twilioCallSid: string;
    from: string;
    to: string;
    signature: string | null;
    requestUrl: string;
  }): Promise<{ twiml: string; status: number }>;
  /** Retell webhook (raw JSON body). */
  handleProviderWebhook?(rawBody: string, signature: string | null): Promise<{ ok: boolean; status: number }>;
  syncProviderCall?(plumberCallId: string): Promise<unknown>;
}
