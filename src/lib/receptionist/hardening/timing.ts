import type { NormalizedTimingHint } from '@/lib/receptionist/hardening/types';

function partsInTimeZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return {
    y: get('year') || '1970',
    m: get('month') || '01',
    d: get('day') || '01',
    weekday: get('weekday') || '',
  };
}

function addDaysYmd(y: string, m: string, d: string, delta: number): string {
  const utc = Date.UTC(Number(y), Number(m) - 1, Number(d) + delta);
  const nd = new Date(utc);
  const yy = nd.getUTCFullYear();
  const mm = String(nd.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(nd.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Deterministic vague timing hints (local business calendar day in `timeZone`).
 * Does not fabricate precise UTC instants for ambiguous phrases.
 */
export function normalizeVagueTimingPhrase(
  phrase: string,
  timeZone: string,
  now: Date = new Date(),
): NormalizedTimingHint {
  const raw = phrase.trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    return {
      sourceField: 'preferredCallbackWindow',
      rawPhrase: raw,
      kind: 'unparsed',
      summary: 'No timing text',
      requiresClarification: true,
    };
  }

  if (/\basap\b|right away|immediately|soonest/i.test(lower)) {
    return {
      sourceField: 'preferredCallbackWindow',
      rawPhrase: raw,
      kind: 'asap_urgent',
      summary: 'ASAP / immediate — not a concrete slot; treat as urgent request',
      requiresClarification: true,
    };
  }

  const { y, m, d } = partsInTimeZone(now, timeZone);
  const todayYmd = `${y}-${m}-${d}`;

  if (/\bwhenever\b|any time|flexible|sometime\b/i.test(lower)) {
    return {
      sourceField: 'preferredCallbackWindow',
      rawPhrase: raw,
      kind: 'open_ended',
      summary: 'Open-ended preference — not a confirmed appointment window',
      localWindowLabel: `Preference noted (${todayYmd} calendar)`,
      requiresClarification: false,
    };
  }

  if (/\bthis week\b/i.test(lower)) {
    return {
      sourceField: 'preferredCallbackWindow',
      rawPhrase: raw,
      kind: 'vague_bucket',
      summary: 'This week — bucket only; confirm concrete slot with dispatch',
      localWindowLabel: `Week containing ${todayYmd}`,
      requiresClarification: true,
    };
  }

  if (/\bnext week\b/i.test(lower)) {
    const start = addDaysYmd(y, m, d, 7);
    return {
      sourceField: 'preferredCallbackWindow',
      rawPhrase: raw,
      kind: 'vague_bucket',
      summary: 'Next week — approximate bucket',
      localWindowLabel: `~week of ${start}`,
      requiresClarification: true,
    };
  }

  if (/\btomorrow\b/i.test(lower)) {
    const tom = addDaysYmd(y, m, d, 1);
    if (/\bmorning\b|first thing/i.test(lower)) {
      return {
        sourceField: 'preferredCallbackWindow',
        rawPhrase: raw,
        kind: 'vague_bucket',
        summary: 'Tomorrow morning — use standard morning callback window policy',
        localWindowLabel: `${tom} 09:00–12:00 (local, policy)`,
        requiresClarification: false,
      };
    }
    if (/\bafternoon\b/i.test(lower)) {
      return {
        sourceField: 'preferredCallbackWindow',
        rawPhrase: raw,
        kind: 'vague_bucket',
        summary: 'Tomorrow afternoon — policy window',
        localWindowLabel: `${tom} 13:00–17:00 (local, policy)`,
        requiresClarification: false,
      };
    }
    if (/\bafter\s*5|after five|evening|tonight\b/i.test(lower)) {
      return {
        sourceField: 'preferredCallbackWindow',
        rawPhrase: raw,
        kind: 'vague_bucket',
        summary: 'After-hours phrasing — verify against business hours',
        localWindowLabel: `${tom} after 17:00 (local, policy)`,
        requiresClarification: true,
      };
    }
    return {
      sourceField: 'preferredCallbackWindow',
      rawPhrase: raw,
      kind: 'vague_bucket',
      summary: 'Tomorrow — date bucket without day-part',
      localWindowLabel: tom,
      requiresClarification: true,
    };
  }

  if (/\blater today\b|today later|end of day\b/i.test(lower)) {
    return {
      sourceField: 'preferredCallbackWindow',
      rawPhrase: raw,
      kind: 'vague_bucket',
      summary: 'Later today — same-day bucket; confirm feasibility vs hours',
      localWindowLabel: `${todayYmd} PM window (policy)`,
      requiresClarification: true,
    };
  }

  if (/\bfirst thing in the morning\b/i.test(lower)) {
    const tom = /\btomorrow\b/i.test(lower) ? addDaysYmd(y, m, d, 1) : todayYmd;
    return {
      sourceField: 'preferredCallbackWindow',
      rawPhrase: raw,
      kind: 'vague_bucket',
      summary: 'First thing morning — policy morning window',
      localWindowLabel: `${tom} early AM (policy)`,
      requiresClarification: false,
    };
  }

  return {
    sourceField: 'preferredCallbackWindow',
    rawPhrase: raw,
    kind: 'unparsed',
    summary: 'Timing phrase not mapped — clarify with caller',
    requiresClarification: true,
  };
}

export function buildTimingHintsFromExtracted(
  preferredCallbackWindow: string | null | undefined,
  preferredVisitWindow: string | null | undefined,
  timeZone: string,
  now?: Date,
): NormalizedTimingHint[] {
  const out: NormalizedTimingHint[] = [];
  if (preferredCallbackWindow?.trim()) {
    out.push({
      ...normalizeVagueTimingPhrase(preferredCallbackWindow, timeZone, now),
      sourceField: 'preferredCallbackWindow',
    });
  }
  if (preferredVisitWindow?.trim()) {
    out.push({
      ...normalizeVagueTimingPhrase(preferredVisitWindow, timeZone, now),
      sourceField: 'preferredVisitWindow',
    });
  }
  return out;
}
