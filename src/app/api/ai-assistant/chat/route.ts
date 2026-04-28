import { NextResponse } from 'next/server';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { buildAwpAgentContext, buildSystemPrompt } from '@/lib/ai/context';
import { createOpenRouterChatCompletion } from '@/lib/ai/openrouter';
import { sql } from '@/lib/db';

type Draft = {
  actionType?: string;
  title?: string;
  payload?: Record<string, unknown>;
  relatedRecordType?: string;
  relatedRecordId?: string;
};

function parseAssistantContent(content: string): { reply: string; actionDrafts: Draft[] } {
  try {
    const parsed = JSON.parse(content) as { reply?: string; actionDrafts?: Draft[] };
    return {
      reply: parsed.reply || content,
      actionDrafts: Array.isArray(parsed.actionDrafts) ? parsed.actionDrafts : [],
    };
  } catch {
    const fenced = content.match(/```json\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        const parsed = JSON.parse(fenced[1]) as { reply?: string; actionDrafts?: Draft[] };
        return {
          reply: parsed.reply || content.replace(fenced[0], '').trim(),
          actionDrafts: Array.isArray(parsed.actionDrafts) ? parsed.actionDrafts : [],
        };
      } catch {
        /* fall through */
      }
    }
    return { reply: content, actionDrafts: [] };
  }
}

async function ensureConversation(companyId: string, userId: string, conversationId: string | null, model: string, prompt: string) {
  if (conversationId) {
    const rows = await sql`
      SELECT id FROM ai_conversations
      WHERE id = ${conversationId} AND company_id = ${companyId}
      LIMIT 1
    `;
    if (rows.length) return conversationId;
  }

  const title = prompt.trim().slice(0, 72) || 'New conversation';
  const result = await sql`
    INSERT INTO ai_conversations (company_id, title, selected_model, created_by_user_id)
    VALUES (${companyId}, ${title}, ${model}, ${userId})
    RETURNING id
  `;
  return String(result[0].id);
}

export async function POST(request: Request) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const body = await request.json();
  const prompt = String(body.message || '').trim();
  const model = String(body.model || 'openrouter/auto');
  const conversationId = body.conversationId ? String(body.conversationId) : null;

  if (!prompt) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

  try {
    const activeConversationId = await ensureConversation(auth.companyId, auth.id, conversationId, model, prompt);
    const context = await buildAwpAgentContext(auth.companyId, prompt);

    const previous = await sql`
      SELECT role, content
      FROM ai_messages
      WHERE conversation_id = ${activeConversationId} AND company_id = ${auth.companyId}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const userMessage = await sql`
      INSERT INTO ai_messages (company_id, conversation_id, role, content, model)
      VALUES (${auth.companyId}, ${activeConversationId}, 'user', ${prompt}, ${model})
      RETURNING id
    `;

    const completion = await createOpenRouterChatCompletion({
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt(context) },
        ...previous
          .reverse()
          .map((row) => ({
            role: String(row.role) === 'assistant' ? 'assistant' as const : 'user' as const,
            content: String(row.content || ''),
          })),
        { role: 'user', content: prompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || 'I could not generate a response.';
    const parsed = parseAssistantContent(raw);
    const usage = completion.usage || {};

    const assistantMessage = await sql`
      INSERT INTO ai_messages (
        company_id,
        conversation_id,
        role,
        content,
        model,
        input_tokens,
        output_tokens,
        context_snapshot_json
      )
      VALUES (
        ${auth.companyId},
        ${activeConversationId},
        'assistant',
        ${parsed.reply},
        ${model},
        ${usage.prompt_tokens ?? null},
        ${usage.completion_tokens ?? null},
        ${JSON.stringify({
          knowledgeIds: context.knowledge.map((item) => item.id),
          leadCount: context.leads.length,
          growthCount: context.growth.length,
        })}
      )
      RETURNING id
    `;

    await sql`
      UPDATE ai_conversations
      SET selected_model = ${model}, updated_at = datetime('now')
      WHERE id = ${activeConversationId} AND company_id = ${auth.companyId}
    `;

    const actionDrafts = [];
    for (const draft of parsed.actionDrafts.slice(0, 5)) {
      if (!draft.actionType || !draft.title) continue;
      const result = await sql`
        INSERT INTO ai_action_drafts (
          company_id,
          conversation_id,
          message_id,
          action_type,
          title,
          payload_json,
          related_record_type,
          related_record_id,
          created_by_user_id
        )
        VALUES (
          ${auth.companyId},
          ${activeConversationId},
          ${assistantMessage[0].id},
          ${draft.actionType},
          ${draft.title},
          ${JSON.stringify(draft.payload || {})},
          ${draft.relatedRecordType || null},
          ${draft.relatedRecordId || null},
          ${auth.id}
        )
        RETURNING id, action_type, title, payload_json, status, created_at
      `;
      actionDrafts.push(result[0]);
    }

    return NextResponse.json({
      conversationId: activeConversationId,
      userMessageId: userMessage[0].id,
      assistantMessage: {
        id: assistantMessage[0].id,
        role: 'assistant',
        content: parsed.reply,
        model,
      },
      actionDrafts: actionDrafts.map((draft) => ({
        id: String(draft.id),
        actionType: String(draft.action_type),
        title: String(draft.title),
        status: String(draft.status),
        payload: draft.payload_json ? JSON.parse(String(draft.payload_json)) : {},
      })),
      context: {
        knowledge: context.knowledge,
        leadCount: context.leads.length,
        growthCount: context.growth.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI assistant request failed' },
      { status: 500 },
    );
  }
}
