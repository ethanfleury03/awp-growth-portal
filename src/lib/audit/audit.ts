import { randomUUID } from 'crypto';
import { sql } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/types';

export type AuditAction =
  | 'invoice.create'
  | 'invoice.update'
  | 'invoice.delete'
  | 'invoice.bulk'
  | 'estimate.create'
  | 'estimate.update'
  | 'estimate.delete'
  | 'estimate.send'
  | 'estimate.sign'
  | 'payment.refund'
  | 'payment.dispute'
  | 'customer.import'
  | 'customer.delete'
  | 'customer.privacy_export'
  | 'customer.privacy_delete'
  | 'team.role_change'
  | 'team.deactivate'
  | 'connect.onboard_start'
  | 'connect.status_refresh'
  | 'feature_flag.update'
  | 'super_admin.impersonate'
  | 'webhook.replay';

export interface AuditWriteInput {
  actor: Pick<SessionUser, 'id' | 'email' | 'role' | 'companyId'>;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Record a single audit row. Audit writes are best-effort — failures are
 * logged but never bubble up to the caller, so a broken audit table can
 * never block a business operation.
 */
export async function writeAudit(input: AuditWriteInput): Promise<void> {
  try {
    const id = randomUUID();
    const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;
    await sql`
      INSERT INTO audit_events (
        id, company_id, actor_user_id, actor_email, actor_role,
        action, entity_type, entity_id, summary, metadata,
        ip_address, user_agent
      ) VALUES (
        ${id},
        ${input.actor.companyId},
        ${input.actor.id ?? null},
        ${input.actor.email ?? null},
        ${input.actor.role ?? null},
        ${input.action},
        ${input.entityType ?? null},
        ${input.entityId ?? null},
        ${input.summary ?? null},
        ${metadataJson},
        ${input.ip ?? null},
        ${input.userAgent ?? null}
      )
    `;
  } catch (err) {
    console.error('[audit] failed to write', err);
  }
}

/**
 * Convenience shortcut that reads IP + UA from a Request.
 */
export function auditFromRequest(req: Request): {
  ip: string | null;
  userAgent: string | null;
} {
  const userAgent = req.headers.get('user-agent');
  const xff = req.headers.get('x-forwarded-for');
  const ip = xff?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
  return { ip: ip ?? null, userAgent };
}
