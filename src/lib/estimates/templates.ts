/**
 * Starter line-item presets (future: replace with price book).
 * Values are suggested unit_price_cents for typical metro plumbing work — adjust in settings/UI later.
 */
export const ESTIMATE_LINE_PRESETS = [
  { category: 'Fees', name: 'Service call / trip fee', unit_price_cents: 8900, unit: 'ea' },
  { category: 'Fees', name: 'Diagnostic / inspection fee', unit_price_cents: 12500, unit: 'ea' },
  { category: 'Repairs', name: 'Faucet repair / replacement (typical)', unit_price_cents: 18500, unit: 'ea' },
  { category: 'Repairs', name: 'Drain clearing (single fixture)', unit_price_cents: 22500, unit: 'ea' },
  { category: 'Repairs', name: 'Toilet repair (fill valve / flapper)', unit_price_cents: 19500, unit: 'ea' },
  { category: 'Repairs', name: 'Water heater repair (diagnostic + minor)', unit_price_cents: 27500, unit: 'ea' },
  { category: 'Fees', name: 'After-hours / emergency surcharge', unit_price_cents: 15000, unit: 'ea', is_optional: true },
] as const;
