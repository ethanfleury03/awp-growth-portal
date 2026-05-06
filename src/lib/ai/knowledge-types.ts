export const KNOWLEDGE_ITEM_TYPES = [
  'Company Facts',
  'Services',
  'Sales Rules',
  'FAQs',
  'Website Notes',
  'Marketing Voice',
  'Reusable Architecture',
  'Images/Files',
  'Do Not Say',
  'Pricing/Warranty Guardrails',
  'Other',
] as const;

export const KNOWLEDGE_STATUSES = ['Active', 'Draft', 'Archived'] as const;

export const KNOWLEDGE_CONFIDENCE_LEVELS = ['Verified', 'Likely', 'Stale'] as const;

export type KnowledgeItemType = (typeof KNOWLEDGE_ITEM_TYPES)[number];
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];
export type KnowledgeConfidence = (typeof KNOWLEDGE_CONFIDENCE_LEVELS)[number];
