/**
 * Canonical paths for Retell webhooks and WNY Automation Portal custom function routes.
 * Keep in sync with `src/app/api/receptionist/providers/retell/`.
 */
export const RETELL_WEBHOOK_PATH = '/api/receptionist/providers/retell/webhook';

export const RETELL_FUNCTIONS_BASE_PATH = '/api/receptionist/providers/retell/functions';

/** Slug segments under RETELL_FUNCTIONS_BASE_PATH (directory names). */
export const RETELL_FUNCTION_SLUGS = [
  'get_receptionist_context',
  'get_availability',
  'create_lead',
  'book_callback',
  'book_quote_visit',
  'flag_emergency',
  'mark_spam',
  'end_call_notes',
] as const;

export type RetellFunctionSlug = (typeof RETELL_FUNCTION_SLUGS)[number];

export function joinAppUrl(appBaseUrl: string, path: string): string {
  const base = appBaseUrl.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export function retellWebhookUrl(appBaseUrl: string): string {
  return joinAppUrl(appBaseUrl, RETELL_WEBHOOK_PATH);
}

export function retellFunctionUrl(appBaseUrl: string, slug: RetellFunctionSlug): string {
  return joinAppUrl(appBaseUrl, `${RETELL_FUNCTIONS_BASE_PATH}/${slug}`);
}
