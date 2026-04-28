import type { LlmCreateParams } from 'retell-sdk/resources/llm';

import {
  type RetellFunctionSlug,
  retellFunctionUrl,
  RETELL_FUNCTION_SLUGS,
} from './routes';

export type ToolParameterSchema = LlmCreateParams.CustomTool.Parameters;

const CALL_BINDING_PROPS = {
  call_id: {
    type: 'string',
    description: 'Retell call id for this conversation (preferred when available).',
  },
  receptionist_call_id: {
    type: 'string',
    description: 'WNY Automation Portal receptionist_calls.id from registerPhoneCall metadata / dynamic variables.',
  },
} as const;

/** Retell / LLM often uses these instead of preferred_callback_window — backend normalizes them. */
const CALLBACK_WINDOW_ALIASES = {
  time_preference: { type: 'string', description: 'Natural-language timing; stored as preferred callback window.' },
  callback_window: { type: 'string', description: 'Alias for preferred_callback_window.' },
  when: { type: 'string', description: 'Alias for preferred_callback_window.' },
  preferred_time: { type: 'string', description: 'Alias for preferred_callback_window.' },
  callback_time: { type: 'string', description: 'Alias for preferred_callback_window.' },
} as const;

const NOTES_ALIASES = {
  note: { type: 'string', description: 'Alias for notes.' },
  message: { type: 'string', description: 'Alias for notes.' },
  internal_notes: { type: 'string', description: 'Alias for notes.' },
  call_notes: { type: 'string', description: 'Alias for notes.' },
  memo: { type: 'string', description: 'Alias for notes.' },
} as const;

const EXTRACT_PROPS = {
  caller_name: { type: 'string', description: 'Caller full name.' },
  callerName: { type: 'string', description: 'Alias for caller_name.' },
  phone: { type: 'string', description: 'Callback number in E.164 or readable form.' },
  callback_number: { type: 'string', description: 'Alias for phone.' },
  address: { type: 'string', description: 'Service address.' },
  service_address: { type: 'string', description: 'Alias for address.' },
  issue_type: { type: 'string', description: 'Short issue category.' },
  issue_description: { type: 'string', description: 'What is happening.' },
  issue: { type: 'string', description: 'Alias for issue_description.' },
  urgency: {
    type: 'string',
    description: 'Caller-reported urgency: low | medium | high | emergency.',
  },
  preferred_callback_window: { type: 'string', description: 'Agreed callback window text.' },
  preferred_visit_window: { type: 'string', description: 'Agreed on-site quote window text.' },
} as const;

export type FunctionSpecExample = {
  request: Record<string, unknown>;
  response: Record<string, unknown>;
};

export type FunctionSpec = {
  slug: RetellFunctionSlug;
  purpose: string;
  whenToCall: string;
  /** OpenAPI-ish request/response shapes for docs */
  requestSchema: Record<string, unknown>;
  responseSchema: Record<string, unknown>;
  example: FunctionSpecExample;
  /** Retell custom tool parameters (JSON Schema object) */
  retellParameters: ToolParameterSchema;
  retellDescription: string;
};

export const RECEPTIONIST_FUNCTION_SPECS: FunctionSpec[] = [
  {
    slug: 'get_receptionist_context',
    purpose: 'Load company name, policies, business hours, after-hours mode, and JSON hints from WNY Automation Portal settings.',
    whenToCall: 'Near the start of every call, before promising scheduling or policy.',
    requestSchema: {
      type: 'object',
      properties: { ...CALL_BINDING_PROPS },
      additionalProperties: true,
    },
    responseSchema: {
      type: 'object',
      properties: {
        ok: { const: true },
        context: { type: 'object' },
      },
    },
    example: {
      request: {},
      response: {
        ok: true,
        context: {
          companyName: 'Demo Plumbing',
          afterHoursMode: 'message',
          disclosureEnabled: true,
        },
      },
    },
    retellParameters: {
      type: 'object',
      properties: { ...CALL_BINDING_PROPS },
    },
    retellDescription:
      'Fetch WNY Automation Portal receptionist settings: company, hours, after-hours mode, emergency keywords, allowed actions.',
  },
  {
    slug: 'get_availability',
    purpose: 'Return deterministic suggested booking windows from WNY Automation Portal (not a live calendar optimizer).',
    whenToCall: 'Before offering specific callback or quote visit times.',
    requestSchema: {
      type: 'object',
      properties: { ...CALL_BINDING_PROPS },
      additionalProperties: true,
    },
    responseSchema: {
      type: 'object',
      properties: {
        ok: { const: true },
        availability: {
          type: 'object',
          properties: {
            windows: { type: 'array', items: { type: 'object' } },
            timezone: { type: 'string' },
          },
        },
      },
    },
    example: {
      request: {},
      response: {
        ok: true,
        availability: {
          timezone: 'America/Toronto',
          windows: [{ label: 'Tomorrow morning', start: '2026-04-13T14:00:00.000Z', end: '2026-04-13T15:00:00.000Z' }],
        },
      },
    },
    retellParameters: {
      type: 'object',
      properties: { ...CALL_BINDING_PROPS },
    },
    retellDescription: 'Get suggested availability windows; present as options, not guarantees.',
  },
  {
    slug: 'create_lead',
    purpose: 'Create a CRM lead from the current receptionist call and link it in SQLite.',
    whenToCall: 'Caller is not ready to book but you have enough info for human follow-up.',
    requestSchema: {
      type: 'object',
      properties: { ...CALL_BINDING_PROPS, ...EXTRACT_PROPS },
      required: [],
    },
    responseSchema: {
      type: 'object',
      properties: {
        ok: { const: true },
        leadId: { type: 'string' },
        alreadyLinked: { type: 'boolean' },
      },
    },
    example: {
      request: {
        call_id: 'call_live_abc123',
        caller_name: 'Jane Doe',
        phone: '+14165550123',
        address: '12 River Rd, Toronto',
        issue_description: 'Slow drain in kitchen sink',
        urgency: 'low',
      },
      response: { ok: true, leadId: 'lead_xyz', alreadyLinked: false },
    },
    retellParameters: {
      type: 'object',
      properties: { ...CALL_BINDING_PROPS, ...EXTRACT_PROPS },
    },
    retellDescription:
      'Create a lead in WNY Automation Portal for human follow-up. Requires call_id or receptionist_call_id. Include best-known caller details.',
  },
  {
    slug: 'book_callback',
    purpose: 'Book a callback (job) from extracted + call data in WNY Automation Portal.',
    whenToCall: 'After caller confirms callback window and contact details.',
    requestSchema: {
      type: 'object',
      properties: { ...CALL_BINDING_PROPS, ...EXTRACT_PROPS },
    },
    responseSchema: {
      type: 'object',
      properties: {
        ok: { const: true },
        bookingId: { type: 'string' },
        jobId: { type: 'string' },
      },
    },
    example: {
      request: {
        call_id: 'call_live_abc123',
        preferred_callback_window: 'Tomorrow between 9 and 11 a.m.',
        phone: '+14165550123',
      },
      response: { ok: true, bookingId: 'b_1', jobId: 'j_1' },
    },
    retellParameters: {
      type: 'object',
      properties: { ...CALL_BINDING_PROPS, ...EXTRACT_PROPS, ...CALLBACK_WINDOW_ALIASES },
    },
    retellDescription:
      'Book a phone callback window in WNY Automation Portal. Confirm window verbally before calling. Requires call_id (Retell) or receptionist_call_id (WNY Automation Portal). Retell may nest parameters under args/arguments; callId maps to call_id. Use preferred_callback_window or time_preference / when / callback_window for the agreed window.',
  },
  {
    slug: 'book_quote_visit',
    purpose: 'Book an on-site quote/estimate visit (job) from call data.',
    whenToCall: 'After caller confirms visit window and service address.',
    requestSchema: {
      type: 'object',
      properties: { ...CALL_BINDING_PROPS, ...EXTRACT_PROPS },
    },
    responseSchema: {
      type: 'object',
      properties: {
        ok: { const: true },
        bookingId: { type: 'string' },
        jobId: { type: 'string' },
      },
    },
    example: {
      request: {
        call_id: 'call_live_abc123',
        preferred_visit_window: 'Thursday afternoon',
        address: '44 Maple Ave',
        issue_description: 'Water heater leaking',
        urgency: 'high',
      },
      response: { ok: true, bookingId: 'b_2', jobId: 'j_2' },
    },
    retellParameters: {
      type: 'object',
      properties: { ...CALL_BINDING_PROPS, ...EXTRACT_PROPS },
    },
    retellDescription:
      'Schedule an on-site estimate visit (not a price quote). Confirm address and window before calling. Requires call_id or receptionist_call_id.',
  },
  {
    slug: 'flag_emergency',
    purpose: 'Mark the receptionist call as emergency for dispatch prioritization.',
    whenToCall: 'Active flooding, burst pipe, no water, sewer backup, or similar urgent situations.',
    requestSchema: {
      type: 'object',
      properties: { ...CALL_BINDING_PROPS },
    },
    responseSchema: {
      type: 'object',
      properties: { ok: { const: true }, flagged: { const: true } },
    },
    example: {
      request: { call_id: 'call_live_abc123' },
      response: { ok: true, flagged: true },
    },
    retellParameters: {
      type: 'object',
      properties: { ...CALL_BINDING_PROPS },
    },
    retellDescription: 'Flag the call as emergency in WNY Automation Portal after you assess the situation.',
  },
  {
    slug: 'mark_spam',
    purpose: 'Mark the call as spam / abuse in WNY Automation Portal.',
    whenToCall: 'Clear spam, harassment, or obvious wrong-number abuse.',
    requestSchema: {
      type: 'object',
      properties: { ...CALL_BINDING_PROPS },
    },
    responseSchema: {
      type: 'object',
      properties: { ok: { const: true }, marked: { const: true } },
    },
    example: {
      request: { call_id: 'call_live_abc123' },
      response: { ok: true, marked: true },
    },
    retellParameters: {
      type: 'object',
      properties: { ...CALL_BINDING_PROPS },
    },
    retellDescription: 'Mark spam or abusive calls in WNY Automation Portal.',
  },
  {
    slug: 'end_call_notes',
    purpose: 'Append a lightweight internal note to WNY Automation Portal receptionist_events.',
    whenToCall: 'Optional short internal summary before ending the call.',
    requestSchema: {
      type: 'object',
      properties: {
        ...CALL_BINDING_PROPS,
        notes: { type: 'string' },
        summary: { type: 'string', description: 'Alias for notes.' },
      },
    },
    responseSchema: {
      type: 'object',
      properties: { ok: { const: true }, logged: { const: true } },
    },
    example: {
      request: { call_id: 'call_live_abc123', notes: 'Caller will email photos of leak' },
      response: { ok: true, logged: true },
    },
    retellParameters: {
      type: 'object',
      properties: {
        ...CALL_BINDING_PROPS,
        notes: { type: 'string', description: 'Short internal note.' },
        summary: { type: 'string', description: 'Alias for notes.' },
        ...NOTES_ALIASES,
      },
    },
    retellDescription:
      'Log brief internal notes on the WNY Automation Portal call record. Notes may be in notes, summary, note, message, internal_notes, or memo. Requires call_id or receptionist_call_id; nested args are flattened.',
  },
];

function assertSpecsMatchSlugs() {
  const slugs = new Set(RECEPTIONIST_FUNCTION_SPECS.map((s) => s.slug));
  for (const s of RETELL_FUNCTION_SLUGS) {
    if (!slugs.has(s)) {
      throw new Error(`Missing FunctionSpec for slug: ${s}`);
    }
  }
  if (slugs.size !== RETELL_FUNCTION_SLUGS.length) {
    throw new Error('RECEPTIONIST_FUNCTION_SPECS length mismatch vs RETELL_FUNCTION_SLUGS');
  }
}
assertSpecsMatchSlugs();

export function buildRetellCustomTools(
  appBaseUrl: string,
  toolSharedSecret: string,
): LlmCreateParams.CustomTool[] {
  const authHeader = `Bearer ${toolSharedSecret}`;
  return RECEPTIONIST_FUNCTION_SPECS.map((spec) => {
    const tool: LlmCreateParams.CustomTool = {
      name: spec.slug,
      type: 'custom',
      url: retellFunctionUrl(appBaseUrl, spec.slug),
      method: 'POST',
      args_at_root: true,
      headers: {
        Authorization: authHeader,
      },
      description: spec.retellDescription,
      parameters: spec.retellParameters,
      speak_during_execution: true,
      speak_after_execution: true,
      timeout_ms: 120_000,
    };
    return tool;
  });
}
