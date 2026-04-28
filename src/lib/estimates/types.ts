export const ESTIMATE_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'approved',
  'rejected',
  'expired',
  'converted',
  'archived',
] as const;

export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export const ACTIVITY_EVENT_TYPES = [
  'created',
  'updated',
  'sent',
  'resent',
  'viewed',
  'approved',
  'rejected',
  'expired',
  'converted_to_job',
  'pdf_generated',
  'public_link_opened',
  'line_item_added',
  'line_item_updated',
  'line_item_deleted',
  'manually_approved',
  'manually_rejected',
  'archived',
  'duplicated',
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export const DELIVERY_TYPES = ['email', 'sms_share_link', 'manual_copy_link'] as const;
export type EstimateDeliveryType = (typeof DELIVERY_TYPES)[number];

export type EstimateRow = Record<string, unknown>;
export type EstimateLineItemRow = Record<string, unknown>;
