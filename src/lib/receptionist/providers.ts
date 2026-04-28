/**
 * Provider boundary for future Twilio / voice runtimes.
 * Mock flow uses repository + service directly; Twilio would implement these hooks.
 */

export type InboundVoicePayload = Record<string, unknown>;

export interface ReceptionistTelephonyProvider {
  readonly name: string;
  /** Validate webhook signature when credentials exist; no-op in dev/mock. */
  verifyWebhookSignature(_body: string, _signatureHeader: string | null): boolean;
  /** Map Twilio form body → normalized event (stub). */
  parseInboundVoice(_form: URLSearchParams): InboundVoicePayload;
}

export class MockReceptionistProvider implements ReceptionistTelephonyProvider {
  readonly name = 'mock';

  verifyWebhookSignature(): boolean {
    return true;
  }

  parseInboundVoice(): InboundVoicePayload {
    return {};
  }
}

/**
 * Placeholder — wire TWILIO_AUTH_TOKEN + request validation when going live.
 */
export class TwilioReceptionistProvider implements ReceptionistTelephonyProvider {
  readonly name = 'twilio';

  verifyWebhookSignature(body: string, signature: string | null): boolean {
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!token || !signature) {
      return process.env.NODE_ENV !== 'production';
    }
    // Stub: real validation uses twilio.validateRequest with full URL + params
    void body;
    void signature;
    return true;
  }

  parseInboundVoice(form: URLSearchParams): InboundVoicePayload {
    return {
      CallSid: form.get('CallSid'),
      From: form.get('From'),
      To: form.get('To'),
      Direction: form.get('Direction'),
    };
  }
}

export function getTelephonyProviderFromEnv(): ReceptionistTelephonyProvider {
  const t = (process.env.RECEPTIONIST_PROVIDER || 'mock').toLowerCase();
  if (t === 'twilio' || t === 'retell' || t === 'custom') {
    return new TwilioReceptionistProvider();
  }
  return new MockReceptionistProvider();
}

/**
 * Future: plug OpenAI / other STT+LLM behind this interface.
 */
export interface VoiceRuntimeAdapter {
  summarizeTranscript(transcript: string): Promise<string>;
  extractStructured(transcript: string): Promise<Record<string, unknown>>;
}

export class StubVoiceRuntimeAdapter implements VoiceRuntimeAdapter {
  async summarizeTranscript(transcript: string): Promise<string> {
    return transcript.slice(0, 200);
  }

  async extractStructured(transcript: string): Promise<Record<string, unknown>> {
    return { stub: true, length: transcript.length };
  }
}
