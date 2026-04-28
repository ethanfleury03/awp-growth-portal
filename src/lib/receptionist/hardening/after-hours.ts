/**
 * Lightweight after-hours detection from `business_hours_json`.
 * Supports shapes like `{ monFri: "8:00-17:00", sat: "closed", sun: "closed" }`.
 */
export function isLikelyAfterHours(
  businessHoursJson: string | null | undefined,
  timeZone: string,
  now: Date = new Date(),
): { afterHours: boolean; note: string } {
  if (!businessHoursJson?.trim()) {
    return { afterHours: false, note: 'Business hours not configured; assuming business hours.' };
  }
  try {
    const o = JSON.parse(businessHoursJson) as Record<string, unknown>;
    const monFri = typeof o.monFri === 'string' ? o.monFri.toLowerCase() : '';
    const sat = typeof o.sat === 'string' ? o.sat.toLowerCase() : '';
    const sun = typeof o.sun === 'string' ? o.sun.toLowerCase() : '';

    const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(now);
    const isWeekend = wd === 'Sat' || wd === 'Sun';
    if (isWeekend) {
      const w = wd === 'Sat' ? sat : sun;
      if (w.includes('closed')) {
        return { afterHours: true, note: 'Weekend closed per settings.' };
      }
    }

    if (monFri.includes('closed')) {
      return { afterHours: true, note: 'Weekday marked closed in settings.' };
    }

    const hourStr = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone,
    }).format(now);
    const hour = Number(hourStr);
    if (Number.isFinite(hour) && monFri && /\d/.test(monFri)) {
      const m = monFri.match(/(\d{1,2})\s*:\d{2}\s*-\s*(\d{1,2})/);
      if (m) {
        const start = Number(m[1]);
        const end = Number(m[2]);
        if (hour < start || hour >= end) {
          return {
            afterHours: true,
            note: `Current local hour ${hour} outside configured ${monFri}.`,
          };
        }
      }
    }

    return { afterHours: false, note: 'Within coarse business-hours heuristic.' };
  } catch {
    return { afterHours: false, note: 'Could not parse business hours JSON.' };
  }
}
