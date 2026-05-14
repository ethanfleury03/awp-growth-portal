import { describe, expect, it } from 'vitest';
import {
  aggregateAiUsageRows,
  calculateAiOverageCents,
} from '@/lib/billing/usage';

describe('billing AI usage', () => {
  it('calculates AI overage cents with the configured multiplier', () => {
    expect(calculateAiOverageCents(0, 2)).toBe(0);
    expect(calculateAiOverageCents(0.001, 2)).toBe(1);
    expect(calculateAiOverageCents(12.345, 2)).toBe(2469);
  });

  it('aggregates provider cost, tokens, and cheap/expensive model buckets', () => {
    const summary = aggregateAiUsageRows([
      {
        model: 'deepseek/deepseek-v4-pro',
        input_tokens: 100,
        output_tokens: 50,
        estimated_cost_usd: '0.25',
        created_at: '2026-05-01 10:00:00',
      },
      {
        model: 'anthropic/claude-opus-4.7',
        input_tokens: 200,
        output_tokens: 100,
        estimated_cost_usd: '1.25',
        created_at: '2026-05-01 11:00:00',
      },
    ]);

    expect(summary.messages).toBe(2);
    expect(summary.inputTokens).toBe(300);
    expect(summary.outputTokens).toBe(150);
    expect(summary.providerCostUsd).toBeCloseTo(1.5);
    expect(summary.overageAmountCents).toBe(300);
    expect(summary.byModel.map((model) => model.costTier)).toEqual(['expensive', 'cheap']);
    expect(summary.byModel[0]).toEqual(
      expect.objectContaining({
        modelId: 'anthropic/claude-opus-4.7',
        overageAmountCents: 250,
      }),
    );
  });

  it('falls back to model pricing when stored estimated cost is missing', () => {
    const summary = aggregateAiUsageRows([
      {
        model: 'deepseek/deepseek-v4-pro',
        input_tokens: 1000,
        output_tokens: 1000,
        created_at: '2026-05-01 10:00:00',
      },
    ]);

    expect(summary.providerCostUsd).toBeGreaterThan(0);
    expect(summary.overageAmountCents).toBeGreaterThan(0);
  });
});
