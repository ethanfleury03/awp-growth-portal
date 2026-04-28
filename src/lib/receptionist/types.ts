export type ReceptionistDisposition =
  | 'callback_booked'
  | 'quote_visit_booked'
  | 'lead_created'
  | 'emergency'
  | 'spam'
  | 'follow_up_needed';

export type ReceptionistCallStatus =
  | 'ringing'
  | 'active'
  | 'completed'
  | 'failed'
  | 'missed'
  | 'mock';

export type TranscriptSpeaker = 'assistant' | 'caller' | 'system';

export interface TranscriptTurn {
  speaker: TranscriptSpeaker;
  text: string;
}

export interface ExtractedCallData {
  callerName: string | null;
  phone: string | null;
  address: string | null;
  issueType: string | null;
  issueDescription: string | null;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  preferredCallbackWindow: string | null;
  preferredVisitWindow: string | null;
  emergencyDetected: boolean;
  existingCustomerPossible: boolean;
  spamLikely: boolean;
  summary: string;
  nextStep: string;
}

export interface MockScenarioDefinition {
  id: string;
  name: string;
  description: string;
  expectedOutcome: ReceptionistDisposition;
  turns: TranscriptTurn[];
  /** Merged with regex/heuristic extraction after call ends */
  extractedBaseline: Partial<ExtractedCallData>;
}

export interface ReceptionistSettingsRow {
  id: string;
  company_name: string | null;
  greeting: string | null;
  disclosure_enabled: number;
  recording_enabled: number;
  business_hours_json: string | null;
  after_hours_mode: string | null;
  allowed_actions_json: string | null;
  emergency_keywords_json: string | null;
  booking_rules_json: string | null;
  default_call_outcome_rules_json: string | null;
  provider_type: string;
  provider_config_json: string | null;
  internal_instructions: string | null;
  callback_booking_enabled: number;
  quote_visit_booking_enabled: number;
  retell_agent_id: string | null;
  created_at: string;
  updated_at: string;
}
