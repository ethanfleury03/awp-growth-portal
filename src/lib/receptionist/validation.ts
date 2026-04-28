import { z } from 'zod';

export const receptionistDispositionSchema = z.enum([
  'callback_booked',
  'quote_visit_booked',
  'lead_created',
  'emergency',
  'spam',
  'follow_up_needed',
]);

export const patchSettingsSchema = z
  .object({
    company_name: z.string().max(200).optional().nullable(),
    greeting: z.string().max(2000).optional(),
    disclosure_enabled: z.boolean().optional(),
    recording_enabled: z.boolean().optional(),
    business_hours_json: z.string().optional().nullable(),
    after_hours_mode: z.string().max(120).optional().nullable(),
    allowed_actions_json: z.string().optional().nullable(),
    emergency_keywords_json: z.string().optional().nullable(),
    booking_rules_json: z.string().optional().nullable(),
    default_call_outcome_rules_json: z.string().optional().nullable(),
    provider_type: z.enum(['mock', 'retell', 'twilio', 'custom']).optional(),
    retell_agent_id: z.string().max(120).optional().nullable(),
    provider_config_json: z.string().optional().nullable(),
    internal_instructions: z.string().max(8000).optional().nullable(),
    callback_booking_enabled: z.boolean().optional(),
    quote_visit_booking_enabled: z.boolean().optional(),
  })
  .strict();

export const startMockSchema = z.object({
  scenarioId: z.string().min(1).max(120),
});

export const endMockSchema = z
  .object({
    fastForwardRemaining: z.boolean().optional(),
  })
  .strict()
  .optional();

export const listCallsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const dispositionBodySchema = z.object({
  disposition: receptionistDispositionSchema,
});
