import { sql } from '@/lib/db';
import { mergeReceptionistMeta, parseReceptionistMeta } from '@/lib/receptionist/hardening/merge-meta';
import type { ReceptionistCallMeta } from '@/lib/receptionist/hardening/types';

export type StaffTaskType =
  | 'on_call_assignment'
  | 'urgent_callback'
  | 'dispatch_review'
  | 'emergency_escalation'
  | 'follow_up_generic'
  | 'no_action_duplicate'
  | 'issue_resolved';

export type StaffTaskStatus = 'open' | 'done' | 'cancelled';

export async function insertStaffTask(params: {
  callId: string;
  taskType: StaffTaskType;
  title: string;
  details?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assignedToPlumberId?: string | null;
}) {
  const idRows = await sql`SELECT uuid() AS id`;
  const id = (idRows[0] as { id: string }).id;
  await sql`
    INSERT INTO receptionist_staff_tasks (
      id, call_id, task_type, status, title, details_json, priority, assigned_to_plumber_id
    )
    VALUES (
      ${id},
      ${params.callId},
      ${params.taskType},
      'open',
      ${params.title},
      ${JSON.stringify(params.details ?? {})},
      ${params.priority ?? 'normal'},
      ${params.assignedToPlumberId ?? null}
    )
  `;
  return id;
}

export async function listStaffTasksForCall(callId: string) {
  return sql`
    SELECT * FROM receptionist_staff_tasks
    WHERE call_id = ${callId}
    ORDER BY created_at DESC
  `;
}

export async function updateStaffTaskStatus(taskId: string, status: StaffTaskStatus) {
  await sql`
    UPDATE receptionist_staff_tasks
    SET status = ${status}, updated_at = datetime('now')
    WHERE id = ${taskId}
  `;
}

export type StaffHandoffAction =
  | 'assign_on_call'
  | 'urgent_callback_task'
  | 'dispatch_review'
  | 'escalate_emergency'
  | 'mark_resolved'
  | 'mark_duplicate_no_action'
  | 'link_customer_ack';

const ACTION_TITLE: Record<StaffHandoffAction, { type: StaffTaskType; title: string; priority: string }> = {
  assign_on_call: { type: 'on_call_assignment', title: 'Assign to on-call', priority: 'high' },
  urgent_callback_task: { type: 'urgent_callback', title: 'Urgent callback task', priority: 'urgent' },
  dispatch_review: { type: 'dispatch_review', title: 'Dispatch review', priority: 'high' },
  escalate_emergency: {
    type: 'emergency_escalation',
    title: 'Emergency escalation — immediate human',
    priority: 'urgent',
  },
  mark_resolved: { type: 'issue_resolved', title: 'Marked resolved by staff', priority: 'normal' },
  mark_duplicate_no_action: { type: 'no_action_duplicate', title: 'Duplicate / no action needed', priority: 'low' },
  link_customer_ack: { type: 'follow_up_generic', title: 'Customer link acknowledged', priority: 'normal' },
};

export async function applyStaffHandoffAction(
  callId: string,
  action: StaffHandoffAction,
  opts?: { plumberId?: string | null; note?: string },
) {
  const spec = ACTION_TITLE[action];
  const taskId = await insertStaffTask({
    callId,
    taskType: spec.type,
    title: spec.title,
    priority: spec.priority as 'low' | 'normal' | 'high' | 'urgent',
    assignedToPlumberId: opts?.plumberId ?? null,
    details: { action, note: opts?.note },
  });

  const rows = await sql`SELECT receptionist_meta_json FROM receptionist_calls WHERE id = ${callId}`;
  const existing = rows[0]?.receptionist_meta_json as string | undefined;
  const base = parseReceptionistMeta(existing);

  const staffWorkflow: ReceptionistCallMeta['staffWorkflow'] = {
    ...base.staffWorkflow,
    lastStaffAction: action,
    lastStaffActionAt: new Date().toISOString(),
    lastTaskId: taskId,
  };
  if (action === 'mark_resolved') {
    staffWorkflow.waitingOn = null;
    staffWorkflow.recommendedHumanAction = 'Marked resolved — no further action unless caller returns.';
  } else if (action === 'mark_duplicate_no_action') {
    staffWorkflow.waitingOn = null;
    staffWorkflow.recommendedHumanAction = 'Closed as duplicate / no action.';
  }

  const nextJson = mergeReceptionistMeta(existing, { staffWorkflow });
  await sql`
    UPDATE receptionist_calls SET receptionist_meta_json = ${nextJson}, updated_at = datetime('now')
    WHERE id = ${callId}
  `;

  await sql`
    INSERT INTO receptionist_events (call_id, event_type, payload_json, source)
    VALUES (${callId}, ${'staff_handoff_action'}, ${JSON.stringify({ action, taskId, note: opts?.note })}, ${'system'})
  `;
  return { taskId };
}

export async function countOpenUrgentStaffTasks(): Promise<number> {
  const row = await sql`
    SELECT COUNT(*) AS c FROM receptionist_staff_tasks
    WHERE status = 'open' AND priority IN ('high', 'urgent')
  `;
  return Number((row[0] as { c?: number })?.c || 0);
}

/** One open emergency follow-up task per call when no job is linked yet. */
export async function ensureEmergencyHumanFollowUpTask(callId: string) {
  const open = await sql`
    SELECT id FROM receptionist_staff_tasks
    WHERE call_id = ${callId} AND status = 'open' AND task_type = 'emergency_escalation'
    LIMIT 1
  `;
  if (open.length) return (open[0] as { id: string }).id;
  return insertStaffTask({
    callId,
    taskType: 'emergency_escalation',
    title: 'Emergency — human follow-up (no job/booking yet)',
    priority: 'urgent',
    details: { source: 'auto_emergency_flag' },
  });
}
