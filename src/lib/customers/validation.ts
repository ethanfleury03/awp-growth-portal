import { z } from 'zod';

function requiredText(label: string, max: number) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z
      .string({
        required_error: `${label} is required`,
        invalid_type_error: `${label} must be text`,
      })
      .min(1, `${label} is required`)
      .max(max, `${label} is too long`),
  );
}

function nullableText(label: string, max: number) {
  return z.preprocess(
    (value) => {
      if (value == null) return null;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    },
    z
      .string({ invalid_type_error: `${label} must be text` })
      .max(max, `${label} is too long`)
      .nullable(),
  );
}

export const customerPayloadSchema = z.object({
  name: requiredText('Customer name', 180),
  email: z.preprocess(
    (value) => {
      if (value == null) return null;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim().toLowerCase();
      return trimmed ? trimmed : null;
    },
    z
      .string({ invalid_type_error: 'Email must be text' })
      .email('Enter a valid email address')
      .max(254, 'Email is too long')
      .nullable(),
  ),
  phone: requiredText('Phone', 64),
  address: nullableText('Address', 500),
  notes: nullableText('Notes', 5000),
});

export type CustomerPayload = z.infer<typeof customerPayloadSchema>;

export function normalizeCustomerPayload(input: unknown):
  | { ok: true; value: CustomerPayload }
  | { ok: false; error: string } {
  const parsed = customerPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || 'Invalid customer details',
    };
  }
  return { ok: true, value: parsed.data };
}
