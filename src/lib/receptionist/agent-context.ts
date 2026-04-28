import { ensureReceptionistSettings } from '@/lib/receptionist/repository';

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const TZ = process.env.RECEPTIONIST_DEFAULT_TIMEZONE || 'America/Toronto';

/** Minimal after-hours check: Mon–Fri 8–17 local if business_hours_json lacks structure. */
export function isLikelyAfterHours(businessHours: Record<string, unknown>): boolean {
  const now = new Date();
  const local = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const wd = local.find((p) => p.type === 'weekday')?.value || '';
  const hour = parseInt(local.find((p) => p.type === 'hour')?.value || '12', 10);
  const weekend = wd === 'Sat' || wd === 'Sun';
  const monFri = businessHours.monFri as string | undefined;
  if (typeof monFri === 'string' && monFri.includes('-')) {
    const [a, b] = monFri.split('-').map((s) => parseInt(s.trim().split(':')[0] || '0', 10));
    if (!weekend && Number.isFinite(a) && Number.isFinite(b) && hour >= a && hour < b) {
      return false;
    }
  } else if (!weekend && hour >= 8 && hour < 17) {
    return false;
  }
  return true;
}

export async function getReceptionistContextForAgent() {
  const s = await ensureReceptionistSettings();
  const businessHours = safeJson<Record<string, unknown>>(s.business_hours_json, {});
  const afterHours = isLikelyAfterHours(businessHours);

  return {
    companyName: s.company_name,
    greeting: s.greeting,
    disclosureEnabled: Boolean(s.disclosure_enabled),
    recordingEnabled: Boolean(s.recording_enabled),
    businessHours,
    afterHoursMode: s.after_hours_mode,
    allowedActions: safeJson<string[]>(s.allowed_actions_json, []),
    emergencyKeywords: safeJson<string[]>(s.emergency_keywords_json, []),
    bookingRules: safeJson<Record<string, unknown>>(s.booking_rules_json, {}),
    internalInstructions: s.internal_instructions,
    callbackBookingEnabled: Boolean(s.callback_booking_enabled),
    quoteVisitBookingEnabled: Boolean(s.quote_visit_booking_enabled),
    isAfterHours: afterHours,
    policy: {
      neverQuotePrices: true,
      neverPromiseExactArrivalUnlessConfirmed: true,
      identifyAsAi: true,
    },
    timezone: TZ,
  };
}

/** Deterministic “availability” for agent hints — not a full scheduler. */
export async function getAvailabilityForAgent() {
  const s = await ensureReceptionistSettings();
  const afterHours = isLikelyAfterHours(safeJson(s.business_hours_json, {}));
  const windows: Array<{ label: string; start: string; end: string }> = [];

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const base = new Date();
  for (let i = 1; i <= 5; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const day = fmt(d);
    windows.push({
      label: `${day} morning callback`,
      start: `${day}T09:00:00.000Z`,
      end: `${day}T12:00:00.000Z`,
    });
    windows.push({
      label: `${day} afternoon estimate`,
      start: `${day}T13:00:00.000Z`,
      end: `${day}T17:00:00.000Z`,
    });
  }

  return {
    afterHours,
    message: afterHours
      ? 'Office may be closed — offer voicemail/callback per after-hours policy.'
      : 'Standard business window — offer same-day/next-day where reasonable.',
    suggestedWindows: windows.slice(0, 6),
  };
}
