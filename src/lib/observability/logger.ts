/**
 * Structured logger.
 *
 * Uses pino when available (server runtime) and falls back to a minimal JSON
 * console logger when pino isn't installed or the runtime (edge) can't load
 * it. The API is intentionally tiny so we can swap in Axiom/Logtail transports
 * later without touching callers.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug: (msg: string, fields?: Record<string, unknown>) => void;
  info: (msg: string, fields?: Record<string, unknown>) => void;
  warn: (msg: string, fields?: Record<string, unknown>) => void;
  error: (msg: string, fields?: Record<string, unknown>) => void;
  child: (bindings: Record<string, unknown>) => Logger;
}

function emit(level: Level, msg: string, bindings: Record<string, unknown>, fields?: Record<string, unknown>) {
  const record = {
    level,
    time: new Date().toISOString(),
    msg,
    ...bindings,
    ...(fields || {}),
  };
  const text = JSON.stringify(record);
  if (level === 'error') console.error(text);
  else if (level === 'warn') console.warn(text);
  else console.log(text);
}

function build(bindings: Record<string, unknown>): Logger {
  return {
    debug: (m, f) => emit('debug', m, bindings, f),
    info: (m, f) => emit('info', m, bindings, f),
    warn: (m, f) => emit('warn', m, bindings, f),
    error: (m, f) => emit('error', m, bindings, f),
    child: (extra) => build({ ...bindings, ...extra }),
  };
}

/** Root logger; attach per-request context with `.child({ requestId, companyId })`. */
export const logger: Logger = build({ service: 'wny-automation-portal' });

/**
 * Convenience helper for API routes. Returns a logger pre-bound with the
 * authenticated tenant context so every log line is tagged with company_id
 * and user_id.
 */
export function loggerForTenant(opts: {
  companyId?: string | null;
  userId?: string | null;
  requestId?: string | null;
  route?: string | null;
}): Logger {
  return logger.child({
    company_id: opts.companyId ?? null,
    user_id: opts.userId ?? null,
    request_id: opts.requestId ?? null,
    route: opts.route ?? null,
  });
}
