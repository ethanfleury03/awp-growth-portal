import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { sql } from '@/lib/db';
import { requireModuleOrRespond } from '@/lib/modules/access';
import {
  ASSISTANT_MODEL_OPTIONS,
  estimateAssistantCostUsd,
  formatAssistantCost,
  getAssistantModelOption,
} from '@/lib/ai/models';

function numberFrom(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function messageCost(row: Record<string, unknown>) {
  const stored = Number(row.estimated_cost_usd || 0);
  if (Number.isFinite(stored) && stored > 0) return stored;
  return estimateAssistantCostUsd(String(row.model || ''), row.input_tokens, row.output_tokens);
}

function isThisMonth(value: unknown) {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export async function GET() {
  const auth = await requireModuleOrRespond('settings');
  if (isPortalResponse(auth)) return auth;

  const rows = await sql`
    SELECT model, input_tokens, output_tokens, estimated_cost_usd, created_at
    FROM ai_messages
    WHERE company_id = ${auth.companyId}
      AND role = 'assistant'
    ORDER BY created_at DESC
    LIMIT 1000
  `;

  const totals = {
    messages: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  };
  const month = {
    messages: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  };
  const byModel = new Map<string, typeof totals>();

  for (const row of rows) {
    const modelId = String(row.model || 'unknown');
    const inputTokens = numberFrom(row.input_tokens);
    const outputTokens = numberFrom(row.output_tokens);
    const costUsd = messageCost(row);
    const bucket = byModel.get(modelId) || { messages: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };

    for (const target of [totals, bucket]) {
      target.messages += 1;
      target.inputTokens += inputTokens;
      target.outputTokens += outputTokens;
      target.costUsd += costUsd;
    }
    byModel.set(modelId, bucket);

    if (isThisMonth(row.created_at)) {
      month.messages += 1;
      month.inputTokens += inputTokens;
      month.outputTokens += outputTokens;
      month.costUsd += costUsd;
    }
  }

  const modelRows = Array.from(byModel.entries())
    .map(([modelId, usage]) => {
      const model = getAssistantModelOption(modelId);
      return {
        modelId,
        name: model?.name || modelId,
        costTier: model?.costTier || 'expensive',
        messages: usage.messages,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.inputTokens + usage.outputTokens,
        costUsd: usage.costUsd,
        costLabel: formatAssistantCost(usage.costUsd),
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd);

  return NextResponse.json({
    usage: {
      totals: {
        ...totals,
        totalTokens: totals.inputTokens + totals.outputTokens,
        costLabel: formatAssistantCost(totals.costUsd),
      },
      month: {
        ...month,
        totalTokens: month.inputTokens + month.outputTokens,
        costLabel: formatAssistantCost(month.costUsd),
      },
      models: ASSISTANT_MODEL_OPTIONS,
      byModel: modelRows,
      trackedMessages: rows.length,
    },
  });
}
