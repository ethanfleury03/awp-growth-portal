/**
 * Starter line-item presets (future: replace with price book).
 * Values default to $0 so staff must enter verified pricing before sending.
 */
export const ESTIMATE_LINE_PRESETS = [
  { category: 'Planning', name: 'Cabin planning consultation', unit_price_cents: 0, unit: 'ea' },
  { category: 'Planning', name: 'Site readiness review', unit_price_cents: 0, unit: 'ea' },
  { category: 'Design', name: 'Design and layout discussion', unit_price_cents: 0, unit: 'ea' },
  { category: 'Coordination', name: 'Permit and delivery coordination', unit_price_cents: 0, unit: 'ea' },
  { category: 'Proposal', name: 'Custom cabin proposal placeholder', unit_price_cents: 0, unit: 'ea' },
  { category: 'Partner', name: 'Referral partner follow-up', unit_price_cents: 0, unit: 'ea', is_optional: true },
] as const;
