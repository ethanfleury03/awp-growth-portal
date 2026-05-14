import {
  estimateAssistantCostUsd,
  formatAssistantCost,
  getAssistantModelOption,
  type AssistantModelCostTier,
} from '@/lib/ai/models';

export const AI_OVERAGE_MULTIPLIER = 2;

export type AiUsageRow = {
  id?: unknown;
  model?: unknown;
  input_tokens?: unknown;
  output_tokens?: unknown;
  estimated_cost_usd?: unknown;
  created_at?: unknown;
  content?: unknown;
};

export type BillingModelUsage = {
  modelId: string;
  name: string;
  costTier: AssistantModelCostTier;
  messages: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  providerCostUsd: number;
  providerCostLabel: string;
  overageAmountCents: number;
  overageLabel: string;
};

export type BillingDailyUsage = {
  date: string;
  messages: number;
  providerCostUsd: number;
  overageAmountCents: number;
};

export type BillingAiUsageSummary = {
  messages: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  providerCostUsd: number;
  providerCostLabel: string;
  overageMultiplier: number;
  overageAmountCents: number;
  overageLabel: string;
  byModel: BillingModelUsage[];
  daily: BillingDailyUsage[];
};

function numberFrom(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrencyFromCents(cents: unknown, currency = 'usd'): string {
  const amount = numberFrom(cents) / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function sqlDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

export function startOfCurrentMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
}

export function startOfNextMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
}

export function subtractOneMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, date.getUTCDate(), 0, 0, 0));
}

export function calculateAiOverageCents(
  providerCostUsd: unknown,
  multiplier = AI_OVERAGE_MULTIPLIER,
): number {
  const amount = numberFrom(providerCostUsd);
  if (amount <= 0) return 0;
  return Math.ceil(amount * multiplier * 100);
}

export function aiMessageProviderCostUsd(row: AiUsageRow): number {
  const stored = numberFrom(row.estimated_cost_usd);
  if (stored > 0) return stored;
  return estimateAssistantCostUsd(String(row.model || ''), row.input_tokens, row.output_tokens);
}

function dayKey(value: unknown): string {
  const raw = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? 'Unknown' : parsed.toISOString().slice(0, 10);
}

export function aggregateAiUsageRows(
  rows: AiUsageRow[],
  multiplier = AI_OVERAGE_MULTIPLIER,
): BillingAiUsageSummary {
  const totals = {
    messages: 0,
    inputTokens: 0,
    outputTokens: 0,
    providerCostUsd: 0,
  };
  const byModel = new Map<string, Omit<BillingModelUsage, 'totalTokens' | 'providerCostLabel' | 'overageAmountCents' | 'overageLabel'>>();
  const byDay = new Map<string, { date: string; messages: number; providerCostUsd: number }>();

  for (const row of rows) {
    const modelId = String(row.model || 'unknown');
    const model = getAssistantModelOption(modelId);
    const inputTokens = numberFrom(row.input_tokens);
    const outputTokens = numberFrom(row.output_tokens);
    const providerCostUsd = aiMessageProviderCostUsd(row);
    const existingModel = byModel.get(modelId) || {
      modelId,
      name: model?.name || modelId,
      costTier: model?.costTier || 'expensive',
      messages: 0,
      inputTokens: 0,
      outputTokens: 0,
      providerCostUsd: 0,
    };
    existingModel.messages += 1;
    existingModel.inputTokens += inputTokens;
    existingModel.outputTokens += outputTokens;
    existingModel.providerCostUsd += providerCostUsd;
    byModel.set(modelId, existingModel);

    const date = dayKey(row.created_at);
    const existingDay = byDay.get(date) || { date, messages: 0, providerCostUsd: 0 };
    existingDay.messages += 1;
    existingDay.providerCostUsd += providerCostUsd;
    byDay.set(date, existingDay);

    totals.messages += 1;
    totals.inputTokens += inputTokens;
    totals.outputTokens += outputTokens;
    totals.providerCostUsd += providerCostUsd;
  }

  const overageAmountCents = calculateAiOverageCents(totals.providerCostUsd, multiplier);
  return {
    ...totals,
    totalTokens: totals.inputTokens + totals.outputTokens,
    providerCostLabel: formatAssistantCost(totals.providerCostUsd),
    overageMultiplier: multiplier,
    overageAmountCents,
    overageLabel: formatCurrencyFromCents(overageAmountCents),
    byModel: Array.from(byModel.values())
      .map((model) => {
        const modelOverageCents = calculateAiOverageCents(model.providerCostUsd, multiplier);
        return {
          ...model,
          totalTokens: model.inputTokens + model.outputTokens,
          providerCostLabel: formatAssistantCost(model.providerCostUsd),
          overageAmountCents: modelOverageCents,
          overageLabel: formatCurrencyFromCents(modelOverageCents),
        };
      })
      .sort((a, b) => b.providerCostUsd - a.providerCostUsd),
    daily: Array.from(byDay.values())
      .map((day) => ({
        ...day,
        overageAmountCents: calculateAiOverageCents(day.providerCostUsd, multiplier),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
