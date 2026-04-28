import { z } from 'zod';
import { ESTIMATE_STATUSES, type EstimateStatus } from '@/lib/estimates/types';

export const estimateStatusSchema = z.enum(ESTIMATE_STATUSES);

export const createEstimateBodySchema = z.object({
  company_id: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(10_000).optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  job_id: z.string().uuid().optional().nullable(),
  receptionist_call_id: z.string().uuid().optional().nullable(),
  source_type: z.string().max(80).optional().nullable(),
  source_id: z.string().max(120).optional().nullable(),
  assigned_to_plumber_id: z.string().uuid().optional().nullable(),
  notes_internal: z.string().max(20_000).optional().nullable(),
  notes_customer: z.string().max(20_000).optional().nullable(),
  expiration_date: z.string().max(40).optional().nullable(),
  discount_amount_cents: z.number().int().min(0).optional(),
  tax_rate_basis_points: z.number().int().min(0).max(1_000_000).optional().nullable(),
  deposit_amount_cents: z.number().int().min(0).optional().nullable(),
  selected_option_group: z.string().max(120).optional().nullable(),
  /** Line items created from company catalog services, in order. */
  catalog_service_ids: z.array(z.string().uuid()).max(100).optional(),
  /** Explicit line items on create (overrides catalog_service_ids when both sent). */
  initial_line_items: z
    .array(
      z.object({
        catalog_service_id: z.string().uuid().optional().nullable(),
        name: z.string().min(1).max(500),
        description: z.string().max(5000).optional().nullable(),
        quantity: z.number().gt(0).max(1_000_000),
        unit: z.string().min(1).max(40).default('ea'),
        unit_price_cents: z.number().int().min(0).max(100_000_000),
        is_taxable: z.boolean().optional(),
      }),
    )
    .max(100)
    .optional(),
});

export const catalogServiceBodySchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  unit_price_cents: z.number().int().min(0).max(100_000_000),
});

export const patchCatalogServiceBodySchema = catalogServiceBodySchema.partial();

export const patchEstimateBodySchema = createEstimateBodySchema.partial().extend({
  status: estimateStatusSchema.optional(),
});

export const lineItemBodySchema = z.object({
  category: z.string().max(120).optional().nullable(),
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  quantity: z.number().gt(0).max(1_000_000),
  unit: z.string().min(1).max(40).default('ea'),
  unit_price_cents: z.number().int().min(0).max(100_000_000),
  is_optional: z.boolean().optional(),
  is_taxable: z.boolean().optional(),
  option_group: z.string().max(120).optional().nullable(),
  sort_order: z.number().int().optional(),
});

export function assertStatusTransition(from: EstimateStatus, to: EstimateStatus): void {
  const allowed: Record<EstimateStatus, EstimateStatus[]> = {
    draft: ['sent', 'archived'],
    sent: ['viewed', 'approved', 'rejected', 'expired', 'archived'],
    viewed: ['approved', 'rejected', 'expired', 'archived'],
    approved: ['converted', 'archived'],
    rejected: ['archived', 'draft'],
    expired: ['archived', 'draft'],
    converted: ['archived'],
    archived: [],
  };
  if (from === to) return;
  if (!allowed[from]?.includes(to)) {
    throw new Error(`Invalid status transition: ${from} -> ${to}`);
  }
}
