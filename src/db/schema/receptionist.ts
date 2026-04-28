import { pgTable, text, timestamp, integer, boolean, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { companies, branches } from './companies';
import { customers, leads, jobs, callLogs, plumbers } from './customers';

export const receptionistMockScenarios = pgTable('receptionist_mock_scenarios', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  transcriptScriptJson: text('transcript_script_json').notNull(),
  expectedOutcome: text('expected_outcome'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const receptionistSettings = pgTable(
  'receptionist_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
    companyName: text('company_name'),
    greeting: text('greeting'),
    disclosureEnabled: boolean('disclosure_enabled').notNull().default(true),
    recordingEnabled: boolean('recording_enabled').notNull().default(false),
    businessHoursJson: text('business_hours_json'),
    afterHoursMode: text('after_hours_mode').default('message_and_callback'),
    allowedActionsJson: text('allowed_actions_json'),
    emergencyKeywordsJson: text('emergency_keywords_json'),
    bookingRulesJson: text('booking_rules_json'),
    defaultCallOutcomeRulesJson: text('default_call_outcome_rules_json'),
    providerType: text('provider_type').notNull().default('mock'),
    providerConfigJson: text('provider_config_json'),
    internalInstructions: text('internal_instructions'),
    callbackBookingEnabled: boolean('callback_booking_enabled').notNull().default(true),
    quoteVisitBookingEnabled: boolean('quote_visit_booking_enabled').notNull().default(true),
    retellAgentId: text('retell_agent_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: uniqueIndex('idx_receptionist_settings_company').on(t.companyId),
  }),
);

export const receptionistCalls = pgTable(
  'receptionist_calls',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    provider: text('provider').notNull().default('mock'),
    providerCallId: text('provider_call_id'),
    twilioCallSid: text('twilio_call_sid'),
    providerAgentId: text('provider_agent_id'),
    providerStatus: text('provider_status'),
    direction: text('direction').notNull().default('inbound'),
    fromPhone: text('from_phone'),
    toPhone: text('to_phone'),
    callerName: text('caller_name'),
    status: text('status').notNull().default('mock'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationSeconds: integer('duration_seconds').default(0),
    transcriptText: text('transcript_text'),
    aiSummary: text('ai_summary'),
    extractedJson: text('extracted_json'),
    recommendedNextStep: text('recommended_next_step'),
    disposition: text('disposition'),
    urgency: text('urgency'),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    appointmentId: text('appointment_id'),
    callLogId: uuid('call_log_id').references(() => callLogs.id, { onDelete: 'set null' }),
    recordingUrl: text('recording_url'),
    rawProviderPayloadJson: text('raw_provider_payload_json'),
    mockScenarioId: uuid('mock_scenario_id'),
    currentTranscriptIndex: integer('current_transcript_index').notNull().default(0),
    receptionistMetaJson: text('receptionist_meta_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_receptionist_calls_company').on(t.companyId),
    createdIdx: index('idx_receptionist_calls_created_at').on(t.createdAt),
    statusIdx: index('idx_receptionist_calls_status').on(t.status),
    twilioSidIdx: uniqueIndex('idx_receptionist_calls_twilio_sid').on(t.twilioCallSid),
    providerCallIdx: uniqueIndex('idx_receptionist_calls_provider_call_id').on(t.providerCallId),
  }),
);

export const receptionistTranscriptSegments = pgTable(
  'receptionist_transcript_segments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    callId: uuid('call_id')
      .notNull()
      .references(() => receptionistCalls.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    speaker: text('speaker').notNull(),
    text: text('text').notNull(),
    timestampMs: integer('timestamp_ms'),
    metadataJson: text('metadata_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    callIdx: index('idx_receptionist_segments_call').on(t.callId),
    callSeqIdx: uniqueIndex('idx_receptionist_segments_call_seq').on(t.callId, t.seq),
  }),
);

export const receptionistEvents = pgTable(
  'receptionist_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    callId: uuid('call_id')
      .notNull()
      .references(() => receptionistCalls.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    payloadJson: text('payload_json'),
    source: text('source').notNull().default('system'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    callIdx: index('idx_receptionist_events_call').on(t.callId),
  }),
);

export const receptionistToolInvocations = pgTable(
  'receptionist_tool_invocations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    callId: uuid('call_id')
      .notNull()
      .references(() => receptionistCalls.id, { onDelete: 'cascade' }),
    toolName: text('tool_name').notNull(),
    requestJson: text('request_json'),
    responseJson: text('response_json'),
    status: text('status').notNull().default('ok'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    callIdx: index('idx_receptionist_tool_call').on(t.callId),
  }),
);

export const receptionistBookings = pgTable(
  'receptionist_bookings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    callId: uuid('call_id')
      .notNull()
      .references(() => receptionistCalls.id, { onDelete: 'cascade' }),
    bookingType: text('booking_type').notNull(),
    status: text('status').notNull().default('requested'),
    requestedWindowStart: text('requested_window_start'),
    requestedWindowEnd: text('requested_window_end'),
    scheduledStart: text('scheduled_start'),
    scheduledEnd: text('scheduled_end'),
    notes: text('notes'),
    assignedTo: text('assigned_to'),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    callIdx: index('idx_receptionist_bookings_call').on(t.callId),
  }),
);

export const receptionistStaffTasks = pgTable(
  'receptionist_staff_tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    callId: uuid('call_id')
      .notNull()
      .references(() => receptionistCalls.id, { onDelete: 'cascade' }),
    taskType: text('task_type').notNull(),
    status: text('status').notNull().default('open'),
    title: text('title').notNull(),
    detailsJson: text('details_json'),
    priority: text('priority').notNull().default('normal'),
    assignedToPlumberId: uuid('assigned_to_plumber_id').references(() => plumbers.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    callIdx: index('idx_receptionist_staff_tasks_call').on(t.callId),
    statusIdx: index('idx_receptionist_staff_tasks_status').on(t.status),
  }),
);

void customers;
