/**
 * Inngest client stub.
 *
 * We keep a tiny abstraction here so route handlers can `enqueueJob(name, payload)`
 * without knowing whether Inngest, a setTimeout, or a cron worker is behind it.
 * When the real Inngest client is added, swap the implementation below and keep
 * the call sites unchanged.
 */

type JobName =
  | 'invoice.pdf.generate'
  | 'notification.email.send'
  | 'notification.sms.send'
  | 'service-contract.materialize'
  | 'webhook.retry';

interface EnqueueOptions {
  /** ISO timestamp — if set, the job shouldn't run before this time. */
  runAt?: string;
  /** Logical idempotency key to deduplicate retries. */
  key?: string;
}

const INNGEST_ENABLED = Boolean(process.env.INNGEST_EVENT_KEY);

/**
 * Enqueue a background job.
 *
 * Currently a no-op in local development (we log the intent). In production,
 * set INNGEST_EVENT_KEY and plug the @inngest/sdk client in here.
 */
export async function enqueueJob(
  name: JobName,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {},
): Promise<void> {
  if (!INNGEST_ENABLED) {
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'job.enqueue.noop',
        job: name,
        payload,
        options,
        time: new Date().toISOString(),
      }),
    );
    return;
  }
  // TODO: replace with `await inngest.send({ name, data: payload, ts, idempotencyKey })`
  console.log(JSON.stringify({ level: 'info', msg: 'job.enqueue.sent', job: name, time: new Date().toISOString() }));
}
